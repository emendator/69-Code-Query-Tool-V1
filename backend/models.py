"""SQLAlchemy ORM models.

- 系统表（主库）: User / Company / InviteCode   → 继承 MasterBase
- 业务表（公司库）: Product / SemanticMapping / ColumnConfig → 继承 BizBase
"""

from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, DateTime, func, UniqueConstraint, ForeignKey
from database import MasterBase, BizBase


def _fmt(dt):
    """Format a datetime to ISO string (or None)."""
    if dt is None:
        return None
    if isinstance(dt, str):
        return dt
    return dt.isoformat()


# ── System models (master DB) ─────────────────────────────────────

class User(MasterBase):
    """Account with role-based permissions (super_admin / admin / user)."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, unique=True)
    role = Column(String(20), nullable=False, default="user")  # super_admin | admin | user
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    status = Column(String(20), nullable=False, default="active")  # active | expired | disabled
    expires_at = Column(DateTime, nullable=True)  # 账号有效时间，空=永久
    invited_by = Column(Integer, ForeignKey("users.id"), nullable=True)  # 邀请其注册的管理员
    invite_code_id = Column(Integer, ForeignKey("invite_codes.id"), nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.datetime("now", "localtime"))
    last_login_at = Column(DateTime, nullable=True)

    def is_expired(self) -> bool:
        if self.expires_at is None:
            return False
        return self.expires_at < datetime.now()

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "role": self.role,
            "company_id": self.company_id,
            "status": self.status,
            "expires_at": _fmt(self.expires_at),
            "invited_by": self.invited_by,
            "invite_code_id": self.invite_code_id,
            "created_at": _fmt(self.created_at),
            "last_login_at": _fmt(self.last_login_at),
        }


class Company(MasterBase):
    """A company owns one isolated 69-code database."""

    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False, unique=True)  # 创建后不可修改
    db_password_hash = Column(String(255), nullable=False)   # 公司数据库密码（bcrypt）
    db_file = Column(String(255), nullable=False)            # company_{id}.db
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.datetime("now", "localtime"))
    updated_at = Column(DateTime, nullable=True, onupdate=func.datetime("now", "localtime"))

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "db_file": self.db_file,
            "created_by": self.created_by,
            "created_at": _fmt(self.created_at),
            "updated_at": _fmt(self.updated_at),
        }


class InviteCode(MasterBase):
    """One-time invite code: level 1 registers admin, level 2 registers user."""

    __tablename__ = "invite_codes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(50), nullable=False, unique=True)
    level = Column(Integer, nullable=False)  # 1=管理员 | 2=用户
    issued_by = Column(Integer, ForeignKey("users.id"), nullable=False)  # 分发者
    status = Column(String(20), nullable=False, default="unused")  # unused | used | revoked
    expires_at = Column(DateTime, nullable=True)          # 邀请码有效时间
    account_expires_at = Column(DateTime, nullable=True)  # 注册账号的默认有效时间
    used_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.datetime("now", "localtime"))

    def is_expired(self) -> bool:
        if self.expires_at is None:
            return False
        return self.expires_at < datetime.now()

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "code": self.code,
            "level": self.level,
            "issued_by": self.issued_by,
            "status": self.status,
            "expires_at": _fmt(self.expires_at),
            "account_expires_at": _fmt(self.account_expires_at),
            "used_by": self.used_by,
            "used_at": _fmt(self.used_at),
            "created_at": _fmt(self.created_at),
        }


# ── Business models (company DB) ──────────────────────────────────

class Product(BizBase):
    """Core product table."""

    __tablename__ = "products"

    id = Column(Integer, primary_key=True, autoincrement=True)
    model = Column(String(255), nullable=False, default="")
    name = Column(String(255), nullable=False, default="")
    code = Column(String(50), nullable=False, default="", index=True, unique=True)
    source = Column(String(255), nullable=False, default="")
    remark = Column(Text, nullable=False, default="")
    created_at = Column(DateTime, nullable=False, server_default=func.datetime("now", "localtime"))
    updated_at = Column(DateTime, nullable=False, server_default=func.datetime("now", "localtime"), onupdate=func.datetime("now", "localtime"))

    def to_dict(self):
        return {
            "id": self.id,
            "model": self.model,
            "name": self.name,
            "code": self.code,
            "source": self.source,
            "remark": self.remark,
            "created_at": _fmt(self.created_at),
            "updated_at": _fmt(self.updated_at),
        }


class SemanticMapping(BizBase):
    """Semantic library: maps source column names to target fields."""

    __tablename__ = "semantic_mappings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_column = Column(String(255), nullable=False, unique=True)
    target_field = Column(String(20), nullable=False)  # 'model' | 'name' | 'code'
    created_at = Column(DateTime, nullable=False, server_default=func.datetime("now", "localtime"))

    def to_dict(self):
        return {
            "id": self.id,
            "source_column": self.source_column,
            "target_field": self.target_field,
            "created_at": _fmt(self.created_at),
        }


class ColumnConfig(BizBase):
    """Column display configuration, separate per view."""

    __tablename__ = "column_config"
    __table_args__ = (
        UniqueConstraint("field", "view_type", name="uq_field_view_type"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    field = Column(String(50), nullable=False)
    view_type = Column(String(20), nullable=False, default="data")  # 'query' | 'data'
    label = Column(String(100), nullable=False)
    width = Column(Integer, nullable=False, default=120)
    visible = Column(Integer, nullable=False, default=1)
    sort_order = Column(Integer, nullable=False, default=0)

    def to_dict(self):
        return {
            "id": self.id,
            "field": self.field,
            "view_type": self.view_type,
            "label": self.label,
            "width": self.width,
            "visible": bool(self.visible),
            "sort_order": self.sort_order,
        }
