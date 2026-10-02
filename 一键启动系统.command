#!/bin/zsh

# 电商客服系统本地开发启动器（macOS 双击运行）
# 固定使用 127.0.0.1:3003，避免与云端域名和其他本地项目混淆。

set -u
# zsh 默认会降低后台任务优先级；开发服务器无需该行为，并且部分环境会拒绝 nice 调用。
unsetopt BG_NICE

PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
LOCAL_HOST="127.0.0.1"
LOCAL_PORT="3003"
LOCAL_URL="http://${LOCAL_HOST}:${LOCAL_PORT}"
DEV_PID=""

# Finder 双击 .command 时 PATH 可能不包含 Homebrew/Node.js。
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

print_line() {
  printf '%s\n' "============================================================"
}

pause_before_close() {
  printf '\n%s\n' "按任意键关闭此窗口。"
  read -k 1 2>/dev/null || true
  printf '\n'
}

fail() {
  printf '\n❌ %s\n' "$1"
  pause_before_close
  exit 1
}

cleanup() {
  if [ -n "$DEV_PID" ] && kill -0 "$DEV_PID" 2>/dev/null; then
    printf '\n正在停止本地开发服务……\n'
    kill -TERM "$DEV_PID" 2>/dev/null || true
    wait "$DEV_PID" 2>/dev/null || true
  fi
}

trap cleanup INT TERM EXIT

clear
print_line
printf '%s\n' "  电商客服 AI 岗位实训系统｜本地一键启动"
print_line
printf '项目目录：%s\n' "$PROJECT_DIR"
printf '访问地址：%s\n\n' "$LOCAL_URL"

cd "$PROJECT_DIR" || fail "无法进入项目目录。"

if ! command -v node >/dev/null 2>&1; then
  fail "没有找到 Node.js。请先安装 Node.js 22，再重新双击启动。"
fi

if ! command -v npm >/dev/null 2>&1; then
  fail "没有找到 npm。请重新安装包含 npm 的 Node.js。"
fi

NODE_MAJOR=$(node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || printf '0')
if [ "$NODE_MAJOR" -lt 20 ]; then
  fail "当前 Node.js 版本过低（$(node -v)），请安装 Node.js 20 或 22。"
fi

printf 'Node.js：%s\n' "$(node -v)"
printf 'npm：%s\n' "$(npm -v)"

if [ ! -f ".env" ]; then
  if [ ! -f ".env.example" ]; then
    fail "缺少 .env 和 .env.example，无法生成本地配置。"
  fi
  cp ".env.example" ".env" || fail "创建 .env 失败。"
  printf '%s\n' "⚠️  已根据 .env.example 创建 .env，请稍后配置真实 AI 密钥。"
fi

# 若项目依赖不存在或 package-lock.json 更新过，自动安装一次。
if [ ! -f "node_modules/next/package.json" ] || \
   [ ! -f "node_modules/.package-lock.json" ] || \
   [ "package-lock.json" -nt "node_modules/.package-lock.json" ]; then
  printf '\n%s\n' "正在安装/更新项目依赖，第一次可能需要几分钟……"
  npm ci || fail "依赖安装失败。请检查网络后重新启动。"
else
  printf '%s\n' "✅ 项目依赖已就绪。"
fi

printf '\n%s\n' "正在准备 Prisma 客户端……"
npm run db:generate || fail "Prisma 客户端生成失败。"

if [ ! -f "prisma/dev.db" ]; then
  printf '\n%s\n' "首次启动：正在创建数据库和演示数据……"
  npm run db:push || fail "数据库结构创建失败。"
  npm run db:seed || fail "演示数据写入失败。"
else
  if ! command -v sqlite3 >/dev/null 2>&1; then
    fail "没有找到 macOS 自带的 sqlite3，无法安全检查本地数据库。"
  fi

  # 旧数据库可能包含 Prisma 不能直接改名的 SQLite 自动唯一索引。
  # 修复脚本只在确有需要时运行，并会先创建带时间戳的数据库备份。
  sh "docker/repair-sqlite-indexes.sh" "prisma/dev.db" || \
    fail "旧版 SQLite 索引升级失败，请保留备份并查看上面的错误。"

  printf '\n%s\n' "正在同步本地数据库结构（不会重复写入演示数据）……"
  npm run db:push || fail "数据库结构同步失败。"
fi

EXISTING_PID=$(lsof -nP -iTCP:"$LOCAL_PORT" -sTCP:LISTEN -t 2>/dev/null | head -n 1 || true)
if [ -n "$EXISTING_PID" ]; then
  if curl -fsS --max-time 3 "${LOCAL_URL}/api/health" 2>/dev/null | grep -q '"status":"ok"'; then
    printf '\n%s\n' "✅ 系统已经在 ${LOCAL_URL} 运行，无需重复启动。"
    if [ "${SKIP_BROWSER_OPEN:-false}" != "true" ] && command -v open >/dev/null 2>&1; then
      open "$LOCAL_URL"
    fi
    trap - INT TERM EXIT
    pause_before_close
    exit 0
  fi

  printf '\n❌ 端口 %s 已被其他程序占用。\n' "$LOCAL_PORT"
  ps -p "$EXISTING_PID" -o pid=,command= 2>/dev/null || true
  fail "请先关闭占用端口的程序，再重新双击启动。"
fi

print_line
printf '%s\n' "正在启动开发服务器……"
printf '%s\n' "启动完成后会自动打开浏览器。"
printf '%s\n' "要停止服务，请在本窗口按 Control+C。"
print_line

# 强制使用本地地址，避免 .env 中的线上域名/HTTPS 配置影响本地调试。
APP_URL="$LOCAL_URL" \
NEXT_PUBLIC_APP_URL="$LOCAL_URL" \
SESSION_COOKIE_SECURE="false" \
npm run dev -- --hostname "$LOCAL_HOST" --port "$LOCAL_PORT" &
DEV_PID=$!

READY="false"
for _ in {1..60}; do
  if ! kill -0 "$DEV_PID" 2>/dev/null; then
    wait "$DEV_PID" 2>/dev/null
    fail "开发服务器启动失败，请查看上面的错误信息。"
  fi

  if curl -fsS --max-time 2 "${LOCAL_URL}/api/health" 2>/dev/null | grep -q '"status":"ok"'; then
    READY="true"
    break
  fi
  sleep 1
done

if [ "$READY" != "true" ]; then
  fail "等待 60 秒后系统仍未就绪，请查看上面的启动日志。"
fi

printf '\n✅ 系统启动成功：%s\n' "$LOCAL_URL"
if [ "${SKIP_BROWSER_OPEN:-false}" != "true" ] && command -v open >/dev/null 2>&1; then
  open "$LOCAL_URL"
fi

wait "$DEV_PID"
EXIT_CODE=$?
DEV_PID=""

if [ "$EXIT_CODE" -ne 0 ]; then
  printf '\n❌ 开发服务器异常退出，退出码：%s\n' "$EXIT_CODE"
  pause_before_close
fi

trap - INT TERM EXIT
exit "$EXIT_CODE"
