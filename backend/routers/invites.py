"""Invite code management endpoints (super_admin / admin)."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import User
from schemas import ApiResponse, InviteCreateRequest
from crud import (
    create_invite,
    get_invite_by_code,
    get_invite_by_id,
    get_user_by_id,
    list_invites,
    revoke_invite,
)
from security import generate_invite_code
from deps import get_current_admin

router = APIRouter(prefix="/api/invites", tags=["invites"])


@router.get("", response_model=ApiResponse)
def list_my_invites(
    page: int = 1,
    page_size: int = 50,
    user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """super_admin sees all invites; admin sees only their own."""
    issued_by = None if user.role == "super_admin" else user.id
    items, total = list_invites(db, issued_by=issued_by, page=page, page_size=page_size)
    data = []
    for inv in items:
        d = inv.to_dict()
        d["used_by_username"] = None
        if inv.used_by:
            u = get_user_by_id(db, inv.used_by)
            d["used_by_username"] = u.username if u else None
        d["issued_by_username"] = None
        if inv.issued_by:
            u = get_user_by_id(db, inv.issued_by)
            d["issued_by_username"] = u.username if u else None
        data.append(d)
    return ApiResponse(
        success=True,
        data={"items": data, "total": total, "page": page, "page_size": page_size},
    )


@router.post("", response_model=ApiResponse)
def create_invite_code(
    req: InviteCreateRequest,
    user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Issue an invite code. Only super_admin may issue level-1 codes."""
    if req.level == 1 and user.role != "super_admin":
        raise HTTPException(status_code=403, detail="仅最高级管理员可分发一级邀请码")
    if req.expires_at is not None and req.expires_at <= datetime.now():
        raise HTTPException(status_code=400, detail="邀请码有效期必须晚于当前时间")

    code = generate_invite_code()
    while get_invite_by_code(db, code) is not None:
        code = generate_invite_code()

    invite = create_invite(
        db,
        code=code,
        level=req.level,
        issued_by=user.id,
        expires_at=req.expires_at,
        account_expires_at=req.account_expires_at,
    )
    return ApiResponse(success=True, data=invite.to_dict(), message="邀请码已生成")


@router.delete("/{invite_id}", response_model=ApiResponse)
def revoke_invite_code(
    invite_id: int,
    user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Revoke an unused invite code (issuer or super_admin)."""
    invite = get_invite_by_id(db, invite_id)
    if invite is None:
        raise HTTPException(status_code=404, detail="邀请码不存在")
    if user.role != "super_admin" and invite.issued_by != user.id:
        raise HTTPException(status_code=403, detail="无权撤销该邀请码")
    if invite.status != "unused":
        raise HTTPException(status_code=400, detail="仅可撤销未使用的邀请码")
    revoke_invite(db, invite)
    return ApiResponse(success=True, message="邀请码已撤销")
