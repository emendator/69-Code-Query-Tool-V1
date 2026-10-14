"""Authentication endpoints: register, login, me, company db password."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import get_db
from models import User
from schemas import (
    ApiResponse,
    RegisterCheckInviteRequest,
    RegisterRequest,
    LoginRequest,
    LoginResponse,
    ChangeCompanyPasswordRequest,
)
from crud import (
    get_user_by_username,
    get_user_by_email,
    get_user_by_id,
    create_user,
    get_company_by_name,
    get_company_by_id,
    create_company,
    get_invite_by_code,
    claim_invite,
    delete_invite,
    cleanup_orphan_companies,
)
from security import hash_password, verify_password, create_access_token
from deps import get_current_user, get_current_admin
from common import build_user_info
from init_auth import ensure_company_biz_db

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _validate_invite(db: Session, code: str):
    """Return a usable invite code or raise."""
    invite = get_invite_by_code(db, code.strip())
    if invite is None or invite.status != "unused" or invite.is_expired():
        raise HTTPException(status_code=400, detail="邀请码无效或已过期")
    return invite


@router.post("/register/check-invite", response_model=ApiResponse)
def check_invite(req: RegisterCheckInviteRequest, db: Session = Depends(get_db)):
    """Validate an invite code before registration; return its level."""
    invite = _validate_invite(db, req.invite_code)
    return ApiResponse(success=True, data={"level": invite.level})


@router.post("/register", response_model=ApiResponse)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new account bound to an email + one-time invite code."""
    invite = _validate_invite(db, req.invite_code)
    role = "admin" if invite.level == 1 else "user"
    # 邮箱统一小写，避免大小写导致的重复注册
    email = req.email.lower()

    # 原子占用邀请码（同一事务内），防止并发下同一邀请码被重复使用注册多个账号
    if not claim_invite(db, invite.id):
        raise HTTPException(status_code=400, detail="邀请码无效或已过期")

    # 唯一性校验（先友好预检，再兜底捕获并发冲突）
    if get_user_by_username(db, req.username):
        raise HTTPException(status_code=400, detail="用户名已存在")
    if get_user_by_email(db, email):
        raise HTTPException(status_code=400, detail="邮箱已被注册")

    company = None
    created_new = False
    user = None
    try:
        # 公司处理：管理员可创建/加入；用户仅加入
        if role == "admin" and req.mode == "create":
            if get_company_by_name(db, req.company_name.strip()):
                raise HTTPException(status_code=400, detail="该公司名已存在，请更换名称或选择加入公司")
            company = create_company(
                db,
                name=req.company_name.strip(),
                db_password_hash=hash_password(req.company_db_password),
                created_by=None,  # 创建用户后再回填
            )
            created_new = True
            # 创建公司业务库（建表 + 默认列配置）
            ensure_company_biz_db(company.id)
        else:
            company = get_company_by_name(db, req.company_name.strip())
            if company is None:
                raise HTTPException(status_code=400, detail="公司不存在，请检查公司名称")
            if not verify_password(req.company_db_password, company.db_password_hash):
                raise HTTPException(status_code=400, detail="公司数据库密码不正确")

        # 创建账号（邀请码使用后即删除，因此不保留 invite_code_id 引用）
        user = create_user(
            db,
            username=req.username,
            password_hash=hash_password(req.password),
            email=email,
            role=role,
            company_id=company.id,
            invited_by=invite.issued_by,
            invite_code_id=None,
            expires_at=invite.account_expires_at,  # 继承邀请码设置的账号有效期
        )
    except IntegrityError:
        # 并发下唯一约束冲突（用户名/邮箱/公司名）→ 回滚（邀请码恢复未使用，可重试）
        db.rollback()
        # 若已创建新公司的业务库文件，删除孤立文件（公司记录已随事务回滚）
        if created_new and company is not None:
            from database import drop_company_db

            drop_company_db(company.id)
        raise HTTPException(
            status_code=400,
            detail="注册信息冲突：用户名、邮箱或公司名称可能已被使用，请更换后重试",
        )
    except HTTPException:
        db.rollback()
        raise

    if created_new:
        company.created_by = user.id
        db.commit()

    # 邀请码一次一码，注册使用后即删除（前端不再展示）
    delete_invite(db, invite)

    token = create_access_token(user)
    return ApiResponse(
        success=True,
        data=LoginResponse(token=token, user=build_user_info(db, user)).model_dump(),
        message="注册成功",
    )


@router.post("/login", response_model=ApiResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    """Login with username + password; rejects disabled / expired accounts."""
    user = get_user_by_username(db, req.username.strip())
    if user is None or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=400, detail="用户名或密码错误")
    if user.status == "disabled":
        raise HTTPException(status_code=403, detail="账号已被禁用，请联系管理员")
    if user.is_expired():
        raise HTTPException(status_code=403, detail="账号有效期已到，请联系管理员")

    user.last_login_at = datetime.now()
    db.commit()

    token = create_access_token(user)
    return ApiResponse(
        success=True,
        data=LoginResponse(token=token, user=build_user_info(db, user)).model_dump(),
    )


@router.get("/me", response_model=ApiResponse)
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return ApiResponse(success=True, data=build_user_info(db, user))


@router.post("/guest/login", response_model=ApiResponse)
def guest_login(db: Session = Depends(get_db)):
    """游客登录：创建临时游客会话（独立公司 + 临时69库）。

    - 游客可使用全部业务功能，但无用户管理界面；
    - 会话数据存于临时公司库，退出登录后自动清除所有使用痕迹。
    """
    import uuid

    suffix = uuid.uuid4().hex[:8]
    # 临时游客公司：created_by 置空，避免与游客用户互相引用，便于清理
    company = create_company(
        db,
        name=f"__游客公司_{suffix}",
        db_password_hash=hash_password(uuid.uuid4().hex),  # 随机库密码（游客无需使用）
        created_by=None,
    )
    ensure_company_biz_db(company.id)
    user = create_user(
        db,
        username=f"guest_{suffix}",
        password_hash=hash_password(uuid.uuid4().hex),  # 游客无实际登录密码
        email=f"guest_{suffix}@guest.local",
        role="guest",
        company_id=company.id,
        invited_by=None,
        invite_code_id=None,
        expires_at=None,
    )
    token = create_access_token(user)
    return ApiResponse(
        success=True,
        data=LoginResponse(token=token, user=build_user_info(db, user)).model_dump(),
        message="游客模式登录成功",
    )


@router.post("/logout", response_model=ApiResponse)
def logout(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """退出登录。游客退出时自动清除全部使用痕迹（用户/公司/69库/上传目录）。"""
    if user.role == "guest":
        import os
        import shutil

        from config import UPLOAD_DIR

        cid = user.company_id
        db.delete(user)
        db.commit()
        # 游客公司已无账号 → 自动删除（含69库文件）
        cleanup_orphan_companies(db)
        if cid:
            shutil.rmtree(os.path.join(UPLOAD_DIR, f"company_{cid}"), ignore_errors=True)
    return ApiResponse(success=True, message="已退出登录")


@router.put("/company/password", response_model=ApiResponse)
def change_company_password(
    req: ChangeCompanyPasswordRequest,
    user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Admin / super_admin can change their company's database password."""
    company = get_company_by_id(db, user.company_id)
    if company is None:
        raise HTTPException(status_code=400, detail="公司不存在")
    if not verify_password(req.old_db_password, company.db_password_hash):
        raise HTTPException(status_code=400, detail="原公司数据库密码不正确")
    company.db_password_hash = hash_password(req.new_db_password)
    company.updated_at = datetime.now()
    db.commit()
    return ApiResponse(success=True, message="公司数据库密码已修改")
