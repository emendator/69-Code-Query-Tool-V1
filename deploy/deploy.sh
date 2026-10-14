#!/usr/bin/env bash
# ============================================================
# 69码查询器 - Ubuntu 云服务器一键部署脚本
#
# 前提：
#   1. 项目已 clone 到 /opt/69code-query（含 backend/ frontend/ deploy/ data/）
#   2. 系统为 Ubuntu 20.04 / 22.04 / 24.04
#
# 用法：
#   cd /opt/69code-query
#   sudo bash deploy/deploy.sh            # 默认 8083 端口
#   sudo bash deploy/deploy.sh 8083       # 指定端口
#
# 会执行：
#   ① 系统依赖  ② Node.js  ③ 后端依赖  ④ 前端构建
#   ⑤ systemd 服务  ⑥ Nginx  ⑦ 防火墙
# ============================================================
set -euo pipefail

# 访问端口：默认 8083
PORT="${1:-8083}"
case "$PORT" in
    ''|*[!0-9]*) echo "[ERROR] 端口必须是数字，例如: sudo bash deploy/deploy.sh 8083"; exit 1;;
esac

APP_DIR="/opt/69code-query"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
DEPLOY_DIR="$APP_DIR/deploy"
BACKEND_PORT="8006"   # 后端内网监听端口（仅 Nginx 反向代理使用，不对外暴露）

echo "============================================================"
echo "  69码查询器 - 云服务器一键部署"
echo "============================================================"

if [ ! -d "$BACKEND_DIR" ]; then
    echo "[ERROR] 找不到 $BACKEND_DIR"
    echo "        请先把项目 clone/上传到 $APP_DIR 后再运行本脚本"
    exit 1
fi

# ---------- 1. 系统依赖 ----------
echo ""
echo "[1/7] 更新系统并安装基础依赖..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y nginx python3 python3-venv python3-pip curl git

# ---------- 2. Node.js ----------
echo ""
echo "[2/7] 安装 Node.js 20 LTS..."
if ! command -v node >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
echo "  Node.js: $(node --version)"
# 国内服务器加速 npm 下载
npm config set registry https://registry.npmmirror.com 2>/dev/null || true

# ---------- 3. 后端依赖 ----------
echo ""
echo "[3/7] 创建 Python 虚拟环境并安装依赖..."
# 确保 data/ 目录存在（业务数据目录被 .gitignore 排除，clone 后不存在，需手动创建）
mkdir -p "$APP_DIR/data"

# ---------- 3.5 生产凭据（.env）----------
# 后端要求 JWT_SECRET_KEY / SUPER_ADMIN_PASSWORD / DEFAULT_COMPANY_DB_PASSWORD 必须由环境变量注入；
# 这里只在键缺失时生成随机值，已存在的键保持不动（不会覆盖线上正在使用的密钥与口令）。
ENV_FILE="$APP_DIR/.env"
rand_secret() { openssl rand -hex 32 2>/dev/null || head -c 48 /dev/urandom | od -An -tx1 | tr -d ' \n'; }
ensure_env_key() {
    local key="$1"
    if ! grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
        printf '%s=%s\n' "$key" "$(rand_secret)" >> "$ENV_FILE"
        echo "  [env] $key 已生成随机值并写入 $ENV_FILE"
    fi
}
touch "$ENV_FILE"
ensure_env_key JWT_SECRET_KEY
ensure_env_key SUPER_ADMIN_PASSWORD
ensure_env_key DEFAULT_COMPANY_DB_PASSWORD
chmod 600 "$ENV_FILE"
cd "$BACKEND_DIR"
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi
# 国内服务器加速 pip 下载
.venv/bin/pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple 2>/dev/null || true
.venv/bin/pip install --upgrade pip -q
.venv/bin/pip install -r requirements.txt -q

# ---------- 4. 前端构建 ----------
echo ""
echo "[4/7] 构建前端页面..."
cd "$FRONTEND_DIR"
npm install --no-audit --no-fund
# 低配服务器限制 Node 堆内存，防止 vite build OOM 卡死整机
NODE_OPTIONS="--max-old-space-size=1024" npm run build

# ---------- 5. systemd 后端服务 ----------
echo ""
echo "[5/7] 配置后端 systemd 服务..."
cp "$DEPLOY_DIR/69code-query.service" /etc/systemd/system/69code-query.service
chown -R www-data:www-data "$APP_DIR"
systemctl daemon-reload
systemctl enable 69code-query
systemctl restart 69code-query

# ---------- 6. Nginx ----------
echo ""
echo "[6/7] 配置 Nginx..."
cp "$DEPLOY_DIR/nginx.conf" /etc/nginx/sites-available/69code-query
# 按指定端口替换监听端口（默认 8083）
sed -i "s/listen 80;/listen $PORT;/" /etc/nginx/sites-available/69code-query
ln -sf /etc/nginx/sites-available/69code-query /etc/nginx/sites-enabled/69code-query
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl reload nginx

# ---------- 7. 防火墙 ----------
echo ""
echo "[7/7] 配置防火墙..."
if command -v ufw >/dev/null 2>&1; then
    ufw allow OpenSSH
    ufw allow "$PORT/tcp"
    ufw --force enable
fi

# 获取公网 IP（用于最后提示）
IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || curl -s --max-time 5 ip.sb 2>/dev/null || echo "你的服务器公网IP")
if [ "$PORT" = "80" ]; then
    ACCESS_URL="http://$IP"
else
    ACCESS_URL="http://$IP:$PORT"
fi

echo ""
echo "============================================================"
echo "  ✅ 部署完成！"
echo "------------------------------------------------------------"
echo "  访问地址:  $ACCESS_URL"
echo ""
echo "  常用命令:"
echo "    查看后端日志:  journalctl -u 69code-query -f"
echo "    重启后端:      systemctl restart 69code-query"
echo "    重载 Nginx:    nginx -t && systemctl reload nginx"
echo "============================================================"
