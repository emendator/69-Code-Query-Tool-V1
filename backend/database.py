"""Database engines and session configuration.

本系统采用「一主库 + 多公司库」结构：
- 主库  data/69code.db                   → 系统表（users/companies/invite_codes）
- 公司库 data/companies/company_{id}.db  → 业务表（products/semantic_mappings/column_config）
每个公司一个独立 SQLite 文件，实现数据物理隔离。
"""

import os
from typing import Dict

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base

from config import DATA_DIR, DATABASE_URL, COMPANY_DATA_DIR

os.makedirs(DATA_DIR, exist_ok=True)

# ── Master DB (system tables) ─────────────────────────────────────

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)


@event.listens_for(engine, "connect")
def set_master_pragma(dbapi_connection, connection_record):
    """Enable WAL mode and enforce foreign keys on master DB."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


MasterBase = declarative_base()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """Yield a master (system) DB session, ensuring it is closed after use."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Business (company) DBs ────────────────────────────────────────

BizBase = declarative_base()

_company_engines: Dict[int, object] = {}
_company_sessionmakers: Dict[int, object] = {}


def _set_company_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def get_company_engine(company_id: int):
    """Return (and lazily create) the engine for a company's business DB."""
    if company_id not in _company_engines:
        os.makedirs(COMPANY_DATA_DIR, exist_ok=True)
        path = os.path.join(COMPANY_DATA_DIR, f"company_{company_id}.db")
        eng = create_engine(
            f"sqlite:///{path}",
            connect_args={"check_same_thread": False},
            echo=False,
        )
        event.listen(eng, "connect", _set_company_pragma)
        _company_engines[company_id] = eng
        _company_sessionmakers[company_id] = sessionmaker(
            autocommit=False, autoflush=False, bind=eng
        )
        # 首次创建引擎时建表（幂等），避免每个请求重复执行 DDL
        BizBase.metadata.create_all(bind=eng)
    return _company_engines[company_id]


def get_company_db(company_id: int):
    """Yield a session bound to a company's business DB."""
    eng = get_company_engine(company_id)
    Session = _company_sessionmakers[company_id]
    db = Session()
    try:
        yield db
    finally:
        db.close()


def drop_company_db(company_id: int) -> None:
    """Dispose the cached engine and delete a company's business DB files.

    用于「公司无账号时自动删除」：删除 company_{id}.db 及 SQLite 的 -wal/-shm 附属文件。
    """
    eng = _company_engines.pop(company_id, None)
    if eng is not None:
        try:
            eng.dispose()
        except Exception:
            pass
    _company_sessionmakers.pop(company_id, None)

    base = os.path.join(COMPANY_DATA_DIR, f"company_{company_id}.db")
    for suffix in ("", "-wal", "-shm"):
        try:
            os.remove(base + suffix)
        except OSError:
            pass
