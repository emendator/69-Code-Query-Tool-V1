"""Security helpers: password hashing, JWT, invite code generation."""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta

from jose import jwt
from passlib.context import CryptContext

from config import JWT_SECRET_KEY, JWT_ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# 邀请码字符集：排除易混淆字符 O/0/I/1
INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def hash_password(password: str) -> str:
    """Hash a plaintext password with bcrypt (auto salt)."""
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plaintext password against a hash. Never raises."""
    try:
        return pwd_context.verify(plain, hashed)
    except Exception:
        return False


def create_access_token(user) -> str:
    """Issue a JWT for a user (HS256)."""
    now = datetime.utcnow()
    payload = {
        "sub": str(user.id),
        "role": user.role,
        "company_id": user.company_id,
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode & validate a JWT. Raises JWTError when invalid/expired."""
    return jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])


def generate_invite_code(length: int = 10) -> str:
    """Generate a high-entropy, human-friendly invite code."""
    return "".join(secrets.choice(INVITE_ALPHABET) for _ in range(length))
