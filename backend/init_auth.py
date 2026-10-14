"""Startup initialization: default company, super admin, and legacy data migration."""

from __future__ import annotations

import os

from sqlalchemy import inspect, text

# 确保模型已注册到对应 Base 元数据
import models  # noqa: F401
from config import (
    DATA_DIR,
    DEFAULT_COMPANY_NAME,
    DEFAULT_COMPANY_DB_PASSWORD,
    SUPER_ADMIN_USERNAME,
    SUPER_ADMIN_PASSWORD,
    SUPER_ADMIN_EMAIL,
)
from database import engine, MasterBase, BizBase, get_company_engine, get_company_db
from crud import (
    get_company_by_name,
    create_company,
    get_user_by_username,
    create_user,
    init_default_column_configs,
    cleanup_orphan_companies,
    cleanup_guest_sessions,
)
from security import hash_password

_MIGRATION_MARKER = os.path.join(DATA_DIR, ".migrated")


def ensure_company_biz_db(company_id: int) -> None:
    """创建（或确保存在）某公司的业务库：建表 + 初始化默认列配置（幂等）。

    供默认公司初始化与管理员注册创建新公司时调用。
    """
    BizBase.metadata.create_all(bind=get_company_engine(company_id))
    company_gen = get_company_db(company_id)
    company_db = next(company_gen)
    try:
        init_default_column_configs(company_db)
    finally:
        company_gen.close()


def init_auth_system() -> None:
    """Idempotent init: default company + super admin + legacy data migration."""
    # 确保系统表已创建（自包含，顺序无关）
    MasterBase.metadata.create_all(bind=engine)

    from database import get_db

    db = next(get_db())
    try:
        # 1) 默认公司（名称与库密码来自 config.py，可由环境变量覆盖）
        company = get_company_by_name(db, DEFAULT_COMPANY_NAME)
        if company is None:
            company = create_company(
                db,
                name=DEFAULT_COMPANY_NAME,
                db_password_hash=hash_password(DEFAULT_COMPANY_DB_PASSWORD),
                created_by=None,
            )
        # 确保默认公司库建表 + 默认列配置
        ensure_company_biz_db(company.id)

        # 2) 最高级管理员（用户名与初始口令来自 config.py，可由环境变量覆盖）
        admin = get_user_by_username(db, SUPER_ADMIN_USERNAME)
        if admin is None:
            create_user(
                db,
                username=SUPER_ADMIN_USERNAME,
                password_hash=hash_password(SUPER_ADMIN_PASSWORD),
                email=SUPER_ADMIN_EMAIL,
                role="super_admin",
                company_id=company.id,
                invited_by=None,
                invite_code_id=None,
                expires_at=None,  # 永久
            )

        # 3) 旧数据迁移（一次性）
        migrate_legacy_data(company.id)

        # 4) 兜底清理：删除历史遗留的无账号公司（含其69库文件）
        cleanup_orphan_companies(db)

        # 5) 清理历史遗留的「已使用」邀请码（旧版本标记为 used；现改为使用即删除）
        #    先解除用户对邀请码的引用，再删除记录
        db.query(models.User).filter(models.User.invite_code_id.isnot(None)).update(
            {"invite_code_id": None}, synchronize_session=False
        )
        db.query(models.InviteCode).filter(models.InviteCode.status == "used").delete(
            synchronize_session=False
        )
        db.commit()

        # 6) 兜底清理遗留的游客会话（游客用户 + 其公司/69库 + 上传目录）
        cleanup_guest_sessions(db)
    finally:
        db.close()


def _write_marker() -> None:
    try:
        with open(_MIGRATION_MARKER, "w", encoding="utf-8") as f:
            f.write("1")
    except OSError:
        pass


def migrate_legacy_data(default_company_id: int) -> None:
    """Copy legacy business tables from the old master DB into the default company DB (once)."""
    if os.path.exists(_MIGRATION_MARKER):
        return

    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    biz_tables = ["products", "semantic_mappings", "column_config"]

    if not any(t in table_names for t in biz_tables):
        _write_marker()
        return

    company_engine = get_company_engine(default_company_id)
    BizBase.metadata.create_all(bind=company_engine)

    with engine.connect() as src_conn:
        with company_engine.begin() as dst_conn:
            for table in biz_tables:
                if table not in table_names:
                    continue
                try:
                    rows = src_conn.execute(text(f'SELECT * FROM "{table}"')).mappings().all()
                except Exception:
                    continue
                if not rows:
                    continue
                cols = list(rows[0].keys())
                col_sql = ", ".join(f'"{c}"' for c in cols)
                ph = ", ".join(f":{c}" for c in cols)
                for row in rows:
                    item = dict(row)
                    # 旧版 column_config 可能没有 view_type 列，补默认值
                    if table == "column_config":
                        item.setdefault("view_type", "data")
                    try:
                        dst_conn.execute(
                            text(
                                f'INSERT OR IGNORE INTO "{table}" ({col_sql}) VALUES ({ph})'
                            ),
                            item,
                        )
                    except Exception:
                        continue

    # 迁移后确保两个视图的默认列配置都存在
    company_gen = get_company_db(default_company_id)
    company_db = next(company_gen)
    try:
        init_default_column_configs(company_db)
    finally:
        company_gen.close()

    _write_marker()
