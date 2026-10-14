#!/usr/bin/env bash
# ============================================================
# 69码查询器 - 服务器更新脚本
#
# 前提：新代码已同步到 /opt/69code-query（git pull）
# 用法：cd /opt/69code-query && sudo bash deploy/update.sh
# 效果：修复权限 → 更新后端依赖 → 重新构建前端 → 重启后端
# ============================================================
set -euo pipefail

APP_DIR="/opt/69code-query"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"

echo "============================================================"
echo "  69码查询器 - 更新服务"
echo "============================================================"

# 0. 低配服务器保障：内存不足时启用 2G swap（vite build 内存峰值高，防整机卡死）
ensure_swap() {
    local mem_kb total_swap_kb
    mem_kb=$(awk '/MemTotal/{print $2}' /proc/meminfo)
    total_swap_kb=$(awk '/SwapTotal/{print $2}' /proc/meminfo)
    if [ "$mem_kb" -lt 2621440 ] && [ "$total_swap_kb" -lt 2097152 ]; then
        if [ ! -f /swapfile2 ]; then
            echo "  [swap] 创建 /swapfile2 (2G)..."
            fallocate -l 2G /swapfile2 2>/dev/null || dd if=/dev/zero of=/swapfile2 bs=1M count=2048
            chmod 600 /swapfile2
            mkswap /swapfile2 >/dev/null 2>&1 || true
        fi
        swapon /swapfile2 2>/dev/null || true
        echo "  [swap] 已启用 /swapfile2"
    fi
}
ensure_swap

# 0. 补齐必需凭据（.env）：后端要求 JWT_SECRET_KEY / SUPER_ADMIN_PASSWORD /
#    DEFAULT_COMPANY_DB_PASSWORD 由环境变量注入；仅在键缺失时生成随机值，
#    已存在的键保持不动，不会改动线上正在使用的密钥与口令。
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

# 0. 修复权限（新上传的文件属主可能是 root，data/ 需 www-data 可写）
echo "[0/4] 修复目录权限..."
chown -R www-data:www-data "$APP_DIR"

# 1. 更新后端 Python 依赖（新增依赖：passlib / python-jose / email-validator 等）
echo "[1/4] 更新后端依赖..."
if [ -d "$BACKEND_DIR/.venv" ]; then
    cd "$BACKEND_DIR"
    .venv/bin/pip install -r requirements.txt -q
    # passlib 1.7.4 与 bcrypt>=4 不兼容（bcrypt 4.0 移除 __about__ 导致密码哈希崩溃），强制锁定
    .venv/bin/pip install "bcrypt==3.2.2" -q
else
    echo "  [WARN] 未找到后端虚拟环境 .venv，跳过（请先运行 deploy/deploy.sh）"
fi

# 2. 重新构建前端
echo "[2/4] 重新构建前端..."
if [ -d "$FRONTEND_DIR" ]; then
    cd "$FRONTEND_DIR"
    npm install --no-audit --no-fund
    # 低配服务器限制 Node 堆内存，防止 vite build OOM 卡死整机
    NODE_OPTIONS="--max-old-space-size=1024" npm run build
else
    echo "  [WARN] 未找到前端目录，跳过前端构建"
fi

# 3. 重启后端服务
echo "[3/4] 重启后端服务..."
systemctl restart 69code-query

# 4. 校验状态
echo "[4/4] 检查服务状态..."
systemctl --no-pager status 69code-query --lines=3 || true

echo ""
echo "============================================================"
echo "  ✅ 更新完成！刷新浏览器即可（建议 Ctrl+F5 强刷）"
echo "============================================================"
