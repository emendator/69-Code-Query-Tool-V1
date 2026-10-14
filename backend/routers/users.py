"""User management endpoints (super_admin / admin)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import User, Company, InviteCode
from schemas import ApiResponse, ExtendUserRequest
from crud import get_user_by_id, list_users, cleanup_orphan_companies
from deps import get_current_admin
from common import build_user_info

router = APIRouter(prefix="/api/users", tags=["users"])


def _check_manageable(operator: User, target: User) -> None:
    """管理员仅能管理自己邀请的账号；最高级管理员可管理一切（删除自身/超管另有校验）。"""
    if operator.role == "super_admin":
        return
    # 管理员：只能管理自己邀请的账号（自己邀请的均为用户级），不能管理自己
    if target.id == operator.id or target.invited_by != operator.id:
        raise HTTPException(status_code=403, detail="无权管理该账号")


@router.get("", response_model=ApiResponse)
def list_all_users(
    page: int = 1,
    page_size: int = 50,
    search: str = "",
    role: str = "",
    status: str = "",
    user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    scope = None if user.role == "super_admin" else user
    items, total = list_users(
        db,
        page=page,
        page_size=page_size,
        search=search,
        role=role or None,
        status=status or None,
        scope_user=scope,
    )
    data = [build_user_info(db, u) for u in items]
    return ApiResponse(
        success=True,
        data={"items": data, "total": total, "page": page, "page_size": page_size},
    )


@router.put("/{user_id}/extend", response_model=ApiResponse)
def extend_user(
    user_id: int,
    req: ExtendUserRequest,
    user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Extend / reset an account's validity period."""
    target = get_user_by_id(db, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="账号不存在")
    _check_manageable(user, target)

    target.expires_at = req.expires_at
    target.status = "expired" if target.is_expired() else "active"
    db.commit()
    return ApiResponse(success=True, message="有效期已更新")


@router.delete("/{user_id}", response_model=ApiResponse)
def delete_user(
    user_id: int,
    user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Remove an account.

    - super_admin removing an admin cascades to all users invited by that admin.
    - The super_admin account itself can never be removed.
    """
    if user_id == user.id:
        raise HTTPException(status_code=400, detail="不能清除自己的账号")

    target = get_user_by_id(db, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="账号不存在")
    if target.role == "super_admin":
        raise HTTPException(status_code=400, detail="不能清除最高级管理员账号")
    _check_manageable(user, target)

    cascaded = 0
    if user.role == "super_admin" and target.role == "admin":
        # 级联清除：该管理员邀请的全部 user 账号
        cascade_ids = [
            row[0]
            for row in db.query(User.id)
            .filter(User.invited_by == target.id, User.role == "user")
            .all()
        ]
        if cascade_ids:
            cascaded = len(cascade_ids)
            # 1) 解除被级联用户与邀请码的双向外键（users.invite_code_id <-> invites.used_by）
            db.query(User).filter(User.id.in_(cascade_ids)).update(
                {"invite_code_id": None}, synchronize_session=False
            )
            db.query(InviteCode).filter(InviteCode.used_by.in_(cascade_ids)).update(
                {"used_by": None}, synchronize_session=False
            )
            # 2) 删除该管理员分发的全部邀请码
            db.query(InviteCode).filter(InviteCode.issued_by == target.id).delete(
                synchronize_session=False
            )
            # 3) 删除被级联用户
            db.query(User).filter(User.id.in_(cascade_ids)).delete(synchronize_session=False)
            db.flush()

    # 解除其他表对本账号的外键引用（保留审计信息）
    db.query(InviteCode).filter(InviteCode.used_by == target.id).update(
        {"used_by": None}, synchronize_session=False
    )
    db.query(Company).filter(Company.created_by == target.id).update(
        {"created_by": None}, synchronize_session=False
    )

    db.delete(target)
    db.commit()

    # 公司无任何账号时自动删除公司及其69库
    deleted_companies = cleanup_orphan_companies(db)
    msg = f"已清除账号，连带删除 {cascaded} 个关联用户账号"
    if target.company_id in deleted_companies:
        msg += "；该公司已无账号，公司及对应69码库已自动删除"

    return ApiResponse(
        success=True,
        data={"deleted_count": cascaded + 1, "deleted_companies": deleted_companies},
        message=msg,
    )
