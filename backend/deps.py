"""Authentication / authorization dependencies."""

from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from database import get_db
from crud import get_user_by_id
from security import decode_token
from models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the current authenticated user from the JWT (with account checks)."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="登录状态已失效，请重新登录",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
    except JWTError:
        raise credentials_exception

    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    try:
        user = get_user_by_id(db, int(user_id))
    except (ValueError, TypeError):
        # 异常（非数字）的 sub 视为无效凭证
        raise credentials_exception
    if user is None:
        raise credentials_exception
    if user.status == "disabled":
        raise HTTPException(status_code=403, detail="账号已被禁用，请联系管理员")
    if user.is_expired():
        raise HTTPException(status_code=403, detail="账号有效期已到，请联系管理员")
    return user


def get_current_admin(user: User = Depends(get_current_user)) -> User:
    """Only super_admin / admin allowed."""
    if user.role not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="无权限执行该操作")
    return user


def get_current_super_admin(user: User = Depends(get_current_user)) -> User:
    """Only super_admin allowed."""
    if user.role != "super_admin":
        raise HTTPException(status_code=403, detail="仅最高级管理员可执行该操作")
    return user


def get_company_db(user: User = Depends(get_current_user)):
    """Yield a session to the current user's company business DB (auth-gated)."""
    if user.company_id is None:
        raise HTTPException(status_code=400, detail="当前账号未绑定公司")
    from database import get_company_db as _company_db

    yield from _company_db(user.company_id)
