"""Project configuration and built-in keyword lists.

凭据策略：JWT 签名密钥、内置管理员初始口令、默认公司库口令一律由环境变量注入，
仓库内不保留任何默认口令，也不提供可预测的密钥回退值。缺失时模块导入即失败。

配置来源优先级：进程环境变量 > 项目根目录 .env（已被 .gitignore 忽略，可安全保存本地/生产密钥）。
"""

import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)  # project root
DATA_DIR = os.path.join(ROOT_DIR, "data")
DATABASE_URL = f"sqlite:///{os.path.join(DATA_DIR, '69code.db')}"


def _load_dotenv(path: str) -> None:
    """把 .env 中的键值写入进程环境；已存在的环境变量优先。"""
    try:
        with open(path, "r", encoding="utf-8-sig") as fh:
            lines = fh.readlines()
    except OSError:
        return
    for raw in lines:
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and not os.environ.get(key):
            os.environ[key] = value


_load_dotenv(os.path.join(ROOT_DIR, ".env"))


def _require_env(name: str, purpose: str) -> str:
    """读取必需的环境变量；缺失时立即失败，避免任何内置默认凭据。"""
    value = (os.getenv(name) or "").strip()
    if not value:
        raise RuntimeError(
            f"\n[配置错误] 缺少必需的环境变量 {name}（{purpose}）。\n"
            f"  方式一：在项目根目录的 .env 中写入 {name}=<自定义值>（.env 已被 .gitignore 忽略）\n"
            f"  方式二：直接设置环境变量 —— Windows: $env:{name}=\"<自定义值>\"；"
            f"Linux/macOS: export {name}=\"<自定义值>\"\n"
            f"  可参考仓库根目录的 .env.example；Windows 双击 启动.bat 会在首次运行时自动生成随机值写入 .env。\n"
        )
    return value


# ── Auth / 登录权限系统 ───────────────────────────────
JWT_SECRET_KEY = _require_env("JWT_SECRET_KEY", "JWT 签名密钥，请使用足够长的随机字符串")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60 * 12))

# 公司库目录（每公司一个 SQLite 文件）与上传临时目录
COMPANY_DATA_DIR = os.path.join(DATA_DIR, "companies")
UPLOAD_DIR = os.path.join(DATA_DIR, "upload")

# 默认超级管理员（最高级管理员）
# 口令仅在首次初始化（创建 admin 账号）时使用；账号已存在时修改环境变量不会改动既有口令
SUPER_ADMIN_USERNAME = os.getenv("SUPER_ADMIN_USERNAME", "admin")
SUPER_ADMIN_PASSWORD = _require_env("SUPER_ADMIN_PASSWORD", "内置最高级管理员的初始口令，仅首次初始化时使用")
SUPER_ADMIN_EMAIL = os.getenv("SUPER_ADMIN_EMAIL", "admin@example.com")
DEFAULT_COMPANY_NAME = os.getenv("DEFAULT_COMPANY_NAME", "我的公司")
DEFAULT_COMPANY_DB_PASSWORD = _require_env(
    "DEFAULT_COMPANY_DB_PASSWORD", "默认公司的数据库口令（其他账号加入该公司时需要）"
)

# 账号有效期提醒阈值（天）
EXPIRE_WARN_DAYS = 7

# Built-in keyword lists for column matching
MODEL_KEYWORDS = [
    "型号", "规格", "产品型号", "物料号", "料号", "产品编号",
    "货号", "编号", "型号规格", "产品规格",
    "model", "part number", "pn", "part_no", "partno",
    "model no", "model_no", "model number",
    "article number", "art no",
]

NAME_KEYWORDS = [
    "品名", "名称", "产品名称", "商品名", "描述", "产品描述",
    "商品名称", "产品名", "物品名称", "物料描述",
    "name", "product name", "description", "item name",
    "product description", "goods name", "commodity",
]

CODE_KEYWORDS = [
    "69码", "条码", "条形码", "商品条码", "产品条码",
    "EAN", "EAN13", "EAN-13", "ean码",
    "barcode", "bar code", "bar_code",
    "code", "upc", "upc-a",
    "69", "69 code",
]
