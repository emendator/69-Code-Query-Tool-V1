"""Pydantic schemas for request/response validation."""

from __future__ import annotations
from datetime import datetime
from typing import Any, Generic, List, Literal, Optional, TypeVar
from pydantic import BaseModel, Field, EmailStr

T = TypeVar("T")


# ── Generic API Response ──────────────────────────────────────────

class ApiResponse(BaseModel, Generic[T]):
    success: bool = True
    data: Optional[T] = None
    message: str = ""


# ── Product ───────────────────────────────────────────────────────

class ProductCreate(BaseModel):
    model: str = ""
    name: str = ""
    code: str = Field(..., min_length=1)
    remark: str = ""


class ProductUpdate(BaseModel):
    model: str = ""
    name: str = ""
    code: str = Field(..., min_length=1)
    remark: str = ""


class ProductResponse(BaseModel):
    id: int
    model: str
    name: str
    code: str
    source: str
    remark: str
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


# ── Pagination ────────────────────────────────────────────────────

class PageData(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int


# ── Query ─────────────────────────────────────────────────────────

class BatchQueryRequest(BaseModel):
    codes: List[str] = Field(..., min_length=1)


class BatchQueryItem(BaseModel):
    code: str
    found: bool
    row: Optional[ProductResponse] = None


# ── Import ────────────────────────────────────────────────────────

class ImportPreview(BaseModel):
    filename: str
    total_rows: int
    columns: List[str]
    preview_rows: List[dict]


class ColumnMatchResult(BaseModel):
    target_field: str  # 'model' | 'name' | 'code'
    source_column: str
    confidence: str  # 'high' | 'medium' | 'low'


class ColumnMatchResponse(BaseModel):
    matches: List[ColumnMatchResult]
    unmatched: List[str]


class ImportConfirmRequest(BaseModel):
    filename: str
    column_mapping: dict  # { "model": "列名", "name": "列名", "code": "列名" }
    add_to_semantic: bool = False

    class Config:
        json_schema_extra = {
            "example": {
                "filename": "products.xlsx",
                "column_mapping": {"model": "产品型号", "name": "商品名称", "code": "条码"},
                "add_to_semantic": True,
            }
        }


class SkipDetail(BaseModel):
    code: str
    reason: str


class ImportResult(BaseModel):
    total: int
    imported: int
    skipped: int
    skip_details: List[SkipDetail] = []


# ── Config ────────────────────────────────────────────────────────

class ColumnConfigItem(BaseModel):
    field: str
    view_type: str = "data"
    label: str
    width: int = 120
    visible: bool = True
    sort_order: int = 0


class ColumnConfigUpdateRequest(BaseModel):
    columns: List[ColumnConfigItem]


# ── Deduplication ─────────────────────────────────────────────────

class DeduplicateResult(BaseModel):
    deleted_count: int


# ── Semantic ──────────────────────────────────────────────────────

class AddSemanticRequest(BaseModel):
    source_column: str
    target_field: str  # 'model' | 'name' | 'code'

# ── Auth / 登录权限系统 ───────────────────────────────────────────

class RegisterCheckInviteRequest(BaseModel):
    invite_code: str = Field(..., min_length=1, max_length=50)


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=20, pattern=r"^[a-zA-Z0-9_]+$")
    password: str = Field(..., min_length=6, max_length=64)
    email: EmailStr
    invite_code: str = Field(..., min_length=1, max_length=50)
    mode: Literal["create", "join"] = "join"  # 管理员可 create/join；用户强制 join
    company_name: str = Field(..., min_length=1, max_length=255)
    company_db_password: str = Field(..., min_length=1, max_length=64)


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=1, max_length=64)


class ChangeCompanyPasswordRequest(BaseModel):
    old_db_password: str = Field(..., min_length=1, max_length=64)
    new_db_password: str = Field(..., min_length=1, max_length=64)


class UserInfo(BaseModel):
    id: int
    username: str
    role: str
    company_id: Optional[int] = None
    company_name: Optional[str] = None
    email: str
    status: str
    expires_at: Optional[str] = None
    created_at: Optional[str] = None
    last_login_at: Optional[str] = None
    remaining_days: Optional[int] = None


class LoginResponse(BaseModel):
    token: str
    user: UserInfo


# ── Invite codes ──────────────────────────────────────────────────

class InviteCreateRequest(BaseModel):
    level: Literal[1, 2]
    expires_at: Optional[datetime] = None
    account_expires_at: Optional[datetime] = None


# ── User management ───────────────────────────────────────────────

class ExtendUserRequest(BaseModel):
    expires_at: datetime