"""Database CRUD operations."""

from __future__ import annotations
from datetime import datetime
from typing import List, Optional, Tuple

from sqlalchemy import or_
from sqlalchemy.orm import Session

from models import Product, SemanticMapping, ColumnConfig, User, Company, InviteCode
from schemas import ProductCreate, ProductUpdate


# ── Product CRUD ──────────────────────────────────────────────────

def get_products(
    db: Session,
    page: int = 1,
    page_size: int = 50,
    search: str = "",
) -> Tuple[List[Product], int]:
    query = db.query(Product)
    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(
                Product.model.like(like),
                Product.name.like(like),
                Product.code.like(like),
                Product.remark.like(like),
                Product.source.like(like),
            )
        )
    total = query.count()
    items = (
        query.order_by(Product.id.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return items, total


def get_product_by_code(db: Session, code: str) -> Optional[Product]:
    return db.query(Product).filter(Product.code == code).first()


def get_products_by_codes(db: Session, codes: List[str]) -> List[Product]:
    return db.query(Product).filter(Product.code.in_(codes)).all()


def create_product(db: Session, data: ProductCreate) -> Product:
    product = Product(**data.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


def update_product(db: Session, product_id: int, data: ProductUpdate) -> Optional[Product]:
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        return None
    for key, value in data.model_dump().items():
        setattr(product, key, value)
    db.commit()
    db.refresh(product)
    return product


def delete_product(db: Session, product_id: int) -> bool:
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        return False
    db.delete(product)
    db.commit()
    return True


def delete_products(db: Session, ids: List[int]) -> int:
    deleted = db.query(Product).filter(Product.id.in_(ids)).delete(synchronize_session=False)
    db.commit()
    return deleted


def bulk_import(db: Session, records: List[dict]) -> Tuple[int, int, List[dict]]:
    """Bulk import records. Returns (imported_count, skipped_count, skip_details)."""
    # Collect all codes from incoming records
    incoming_codes = {rec.get("code", "") for rec in records if rec.get("code")}

    # Query all existing codes in one batch
    existing_codes = set()
    if incoming_codes:
        rows = (
            db.query(Product.code)
            .filter(Product.code.in_(list(incoming_codes)))
            .all()
        )
        existing_codes = {row[0] for row in rows}

    # Track codes already seen in this batch (intra-file duplicates)
    seen_in_batch: set = set()

    imported = 0
    skipped = 0
    skip_details: List[dict] = []
    for rec in records:
        code = rec.get("code", "")
        if not code:
            skipped += 1
            skip_details.append({"code": "", "reason": "69码为空"})
            continue
        if code in seen_in_batch:
            skipped += 1
            skip_details.append({"code": code, "reason": "本次导入文件中存在重复的69码"})
            continue
        if code in existing_codes:
            skipped += 1
            skip_details.append({"code": code, "reason": "数据库中已存在该69码"})
            continue
        seen_in_batch.add(code)
        product = Product(**rec)
        db.add(product)
        imported += 1
    db.commit()
    return imported, skipped, skip_details


# ── Deduplication ─────────────────────────────────────────────────

def get_duplicate_codes(db: Session) -> List[str]:
    """Return list of codes that appear more than once."""
    from sqlalchemy import func
    result = (
        db.query(Product.code, func.count(Product.id).label("cnt"))
        .group_by(Product.code)
        .having(func.count(Product.id) > 1)
        .all()
    )
    return [row.code for row in result]


def get_duplicate_products(db: Session) -> List[Product]:
    """Return all products whose code is duplicated."""
    dup_codes = get_duplicate_codes(db)
    if not dup_codes:
        return []
    return (
        db.query(Product)
        .filter(Product.code.in_(dup_codes))
        .order_by(Product.code, Product.id)
        .all()
    )


def deduplicate_products(db: Session) -> int:
    """Remove duplicate products keeping the one with smallest id. Returns deleted count."""
    from sqlalchemy import func

    # Get codes that appear more than once
    dup_codes = get_duplicate_codes(db)
    if not dup_codes:
        return 0

    deleted_total = 0
    for code in dup_codes:
        # Keep the minimum id, delete others
        sub = (
            db.query(func.min(Product.id).label("min_id"))
            .filter(Product.code == code)
            .scalar()
        )
        if sub is not None:
            deleted = (
                db.query(Product)
                .filter(Product.code == code, Product.id != sub)
                .delete(synchronize_session=False)
            )
            deleted_total += deleted
    db.commit()
    return deleted_total


# ── Semantic Mappings ─────────────────────────────────────────────

def get_all_semantic_mappings(db: Session) -> List[SemanticMapping]:
    return db.query(SemanticMapping).all()


def add_semantic_mapping(db: Session, source_column: str, target_field: str) -> SemanticMapping:
    existing = db.query(SemanticMapping).filter(SemanticMapping.source_column == source_column).first()
    if existing:
        existing.target_field = target_field
        db.commit()
        db.refresh(existing)
        return existing
    mapping = SemanticMapping(source_column=source_column, target_field=target_field)
    db.add(mapping)
    db.commit()
    db.refresh(mapping)
    return mapping


# ── Column Config ─────────────────────────────────────────────────

def get_column_configs(db: Session, view_type: str = "data") -> List[ColumnConfig]:
    return (
        db.query(ColumnConfig)
        .filter(ColumnConfig.view_type == view_type)
        .order_by(ColumnConfig.sort_order)
        .all()
    )


def update_column_configs(db: Session, configs: List[dict]) -> List[ColumnConfig]:
    updated = []
    for cfg in configs:
        view_type = cfg.get("view_type", "data")
        existing = (
            db.query(ColumnConfig)
            .filter(
                ColumnConfig.field == cfg["field"],
                ColumnConfig.view_type == view_type,
            )
            .first()
        )
        if existing:
            existing.label = cfg.get("label", existing.label)
            existing.width = cfg.get("width", existing.width)
            existing.visible = 1 if cfg.get("visible", True) else 0
            existing.sort_order = cfg.get("sort_order", existing.sort_order)
            updated.append(existing)
        else:
            # Create if not exists (e.g. new field was added)
            new_cfg = ColumnConfig(
                field=cfg["field"],
                view_type=view_type,
                label=cfg.get("label", cfg["field"]),
                width=cfg.get("width", 120),
                visible=1 if cfg.get("visible", True) else 0,
                sort_order=cfg.get("sort_order", 0),
            )
            db.add(new_cfg)
            updated.append(new_cfg)
    db.commit()
    # Refresh to get IDs
    for u in updated:
        db.refresh(u)
    return updated


_DEFAULT_COLUMNS = [
    {"field": "id", "label": "序号", "width": 60, "visible": 1, "sort_order": 1},
    {"field": "model", "label": "型号", "width": 150, "visible": 1, "sort_order": 2},
    {"field": "name", "label": "品名", "width": 200, "visible": 1, "sort_order": 3},
    {"field": "code", "label": "69码", "width": 180, "visible": 1, "sort_order": 4},
    {"field": "source", "label": "数据来源", "width": 150, "visible": 1, "sort_order": 5},
    {"field": "remark", "label": "备注", "width": 200, "visible": 1, "sort_order": 6},
    {"field": "created_at", "label": "导入时间", "width": 160, "visible": 1, "sort_order": 7},
    {"field": "updated_at", "label": "更新时间", "width": 160, "visible": 0, "sort_order": 8},
]


def init_default_column_configs(db: Session):
    """Insert default column configs for both views if empty."""
    for view_type in ("data", "query"):
        existing = db.query(ColumnConfig).filter(ColumnConfig.view_type == view_type).count()
        if existing > 0:
            continue
        for item in _DEFAULT_COLUMNS:
            db.add(ColumnConfig(view_type=view_type, **item))
    db.commit()


# ── User / Company / InviteCode CRUD (master DB) ──────────────────

def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username == username).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()


def create_user(
    db: Session,
    *,
    username: str,
    password_hash: str,
    email: str,
    role: str,
    company_id: int,
    invited_by: Optional[int],
    invite_code_id: Optional[int],
    expires_at: Optional[datetime] = None,
) -> User:
    user = User(
        username=username,
        password_hash=password_hash,
        email=email,
        role=role,
        company_id=company_id,
        invited_by=invited_by,
        invite_code_id=invite_code_id,
        expires_at=expires_at,
        status="active",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def list_users(
    db: Session,
    *,
    page: int = 1,
    page_size: int = 50,
    search: str = "",
    role: Optional[str] = None,
    status: Optional[str] = None,
    scope_user: Optional[User] = None,
) -> Tuple[List[User], int]:
    """List users. scope_user=admin restricts to self + accounts invited by self."""
    query = db.query(User)
    # 游客账号不参与用户管理展示（游客会话为临时一次性）
    query = query.filter(User.role != "guest")
    if scope_user is not None and scope_user.role == "admin":
        query = query.filter(
            or_(
                User.id == scope_user.id,          # 本账号
                User.invited_by == scope_user.id,  # 本账号邀请的账号
            )
        )
    if role:
        query = query.filter(User.role == role)
    if status:
        # 计算状态过滤：'active'=未禁用且未到期；'expired'=已到期；其余按状态列
        now = datetime.now()
        if status == "active":
            query = query.filter(
                User.status == "active",
                or_(User.expires_at.is_(None), User.expires_at >= now),
            )
        elif status == "expired":
            query = query.filter(
                User.expires_at.isnot(None),
                User.expires_at < now,
            )
        else:
            query = query.filter(User.status == status)
    if search:
        like = f"%{search}%"
        query = query.filter(or_(User.username.like(like), User.email.like(like)))
    total = query.count()
    items = (
        query.order_by(User.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return items, total


def get_company_by_id(db: Session, company_id: int) -> Optional[Company]:
    return db.query(Company).filter(Company.id == company_id).first()


def get_company_by_name(db: Session, name: str) -> Optional[Company]:
    return db.query(Company).filter(Company.name == name).first()


def create_company(
    db: Session,
    *,
    name: str,
    db_password_hash: str,
    created_by: Optional[int],
) -> Company:
    company = Company(
        name=name,
        db_password_hash=db_password_hash,
        db_file="",
        created_by=created_by,
    )
    db.add(company)
    db.flush()
    company.db_file = f"company_{company.id}.db"
    db.commit()
    db.refresh(company)
    return company


def get_invite_by_id(db: Session, invite_id: int) -> Optional[InviteCode]:
    return db.query(InviteCode).filter(InviteCode.id == invite_id).first()


def get_invite_by_code(db: Session, code: str) -> Optional[InviteCode]:
    return db.query(InviteCode).filter(InviteCode.code == code).first()


def claim_invite(db: Session, invite_id: int) -> bool:
    """Atomically claim an invite code (unused -> used).

    Returns False if the code was already claimed (e.g. by a concurrent request),
    preventing one invite code from being used to register multiple accounts.
    """
    result = (
        db.query(InviteCode)
        .filter(InviteCode.id == invite_id, InviteCode.status == "unused")
        .update({"status": "used"}, synchronize_session=False)
    )
    return result > 0


def create_invite(
    db: Session,
    *,
    code: str,
    level: int,
    issued_by: int,
    expires_at: Optional[datetime] = None,
    account_expires_at: Optional[datetime] = None,
) -> InviteCode:
    invite = InviteCode(
        code=code,
        level=level,
        issued_by=issued_by,
        expires_at=expires_at,
        account_expires_at=account_expires_at,
        status="unused",
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return invite


def list_invites(
    db: Session,
    *,
    issued_by: Optional[int] = None,
    page: int = 1,
    page_size: int = 50,
) -> Tuple[List[InviteCode], int]:
    query = db.query(InviteCode)
    if issued_by is not None:
        query = query.filter(InviteCode.issued_by == issued_by)
    # 已使用的邀请码已删除/不再展示
    query = query.filter(InviteCode.status != "used")
    total = query.count()
    items = (
        query.order_by(InviteCode.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return items, total


def delete_invite(db: Session, invite: InviteCode) -> None:
    """删除邀请码（注册使用后即删除，前端不再展示）。"""
    db.delete(invite)
    db.commit()


def revoke_invite(db: Session, invite: InviteCode) -> None:
    invite.status = "revoked"
    db.commit()


def cleanup_orphan_companies(db: Session) -> List[int]:
    """删除没有任何账号的公司（公司记录 + 对应69库文件），返回被删除的公司 id 列表。

    - 最高级管理员所属公司（默认公司）受保护，永不自动删除；
    - 用于：账号清除后、注册失败后、启动兜底清理。
    """
    from database import drop_company_db

    # 保护最高级管理员所属公司（默认公司）
    super_admin = db.query(User).filter(User.role == "super_admin").first()
    protected = super_admin.company_id if super_admin else None

    # 仍有账号的公司
    active_company_ids = {
        row[0]
        for row in db.query(User.company_id)
        .filter(User.company_id.isnot(None))
        .distinct()
        .all()
    }
    orphan_ids = [
        cid
        for (cid,) in db.query(Company.id).all()
        if cid not in active_company_ids and cid != protected
    ]
    if orphan_ids:
        db.query(Company).filter(Company.id.in_(orphan_ids)).delete(synchronize_session=False)
        db.commit()
        for cid in orphan_ids:
            drop_company_db(cid)
    return orphan_ids


def cleanup_guest_sessions(db: Session) -> int:
    """删除遗留的游客会话：游客用户 + 其公司（含69库文件）+ 上传目录。返回清理的游客数。

    用于：游客退出登录、服务启动兜底清理（避免游客关闭页面不退出导致的残留）。
    """
    import os
    import shutil

    from config import UPLOAD_DIR

    guest_user_ids = [row[0] for row in db.query(User.id).filter(User.role == "guest").all()]
    if not guest_user_ids:
        return 0

    # 收集游客公司 id（用于清理上传目录）
    guest_company_ids = [
        row[0]
        for row in db.query(User.company_id)
        .filter(User.role == "guest", User.company_id.isnot(None))
        .all()
    ]
    # 解除游客公司对游客用户的引用（created_by），避免外键冲突
    db.query(Company).filter(Company.created_by.in_(guest_user_ids)).update(
        {"created_by": None}, synchronize_session=False
    )
    # 删除游客用户
    db.query(User).filter(User.role == "guest").delete(synchronize_session=False)
    db.commit()

    # 游客公司已无账号 → 自动删除（含69库文件）
    cleanup_orphan_companies(db)

    # 清理游客上传目录
    for cid in guest_company_ids:
        shutil.rmtree(os.path.join(UPLOAD_DIR, f"company_{cid}"), ignore_errors=True)

    return len(guest_user_ids)
