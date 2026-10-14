"""Shared helpers for auth / user endpoints."""

from __future__ import annotations

import math
from datetime import datetime

from crud import get_company_by_id


def remaining_days(user) -> int:
    """Days (ceiled) until account expiry; None for permanent accounts."""
    if user.expires_at is None:
        return 0
    delta = user.expires_at - datetime.now()
    return math.ceil(delta.total_seconds() / 86400)


def build_user_info(db, user) -> dict:
    """Serialize a User into the public info dict (with company name & status)."""
    company = get_company_by_id(db, user.company_id) if user.company_id else None
    data = user.to_dict()
    data["company_name"] = company.name if company else None
    data["remaining_days"] = remaining_days(user) if user.expires_at is not None else None
    # 展示状态：已禁用 > 已过期 > 正常
    if data["status"] != "disabled" and user.is_expired():
        data["status"] = "expired"
    return data
