#!/bin/sh
set -eu
export LC_ALL=C
export LANG=C

PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
PACKAGE_TIME=$(date +%Y%m%d-%H%M%S)
PACKAGE_ROOT=${PACKAGE_OUTPUT_DIR:-"${PROJECT_DIR}/.."}
PACKAGE_DIR="${PACKAGE_ROOT}/宝塔Docker部署包-${PACKAGE_TIME}"
UPLOAD_DIR="${PACKAGE_DIR}/server-upload"
LOCAL_ONLY_DIR="${PACKAGE_DIR}/本地保管-绝对不要上传"
DEPLOY_PUBLIC_URL=${DEPLOY_PUBLIC_URL:-"https://training.example.com"}
DEPLOY_BIND_ADDRESS=${DEPLOY_BIND_ADDRESS:-"127.0.0.1"}
DEPLOY_PORT=${DEPLOY_PORT:-"3000"}
DEPLOY_COOKIE_SECURE=${DEPLOY_COOKIE_SECURE:-"true"}

case "$DEPLOY_PORT" in
  ''|*[!0-9]*) echo "错误：DEPLOY_PORT 必须是数字"; exit 1 ;;
esac
if [ "$DEPLOY_PORT" -lt 1 ] || [ "$DEPLOY_PORT" -gt 65535 ]; then
  echo "错误：DEPLOY_PORT 必须在 1 到 65535 之间"
  exit 1
fi
case "$DEPLOY_COOKIE_SECURE" in
  true|false) ;;
  *) echo "错误：DEPLOY_COOKIE_SECURE 只能是 true 或 false"; exit 1 ;;
esac
case "$DEPLOY_PUBLIC_URL" in
  http://*)
    if [ "$DEPLOY_COOKIE_SECURE" != "false" ]; then
      echo "错误：HTTP 地址必须搭配 DEPLOY_COOKIE_SECURE=false"
      exit 1
    fi
    ;;
  https://*)
    if [ "$DEPLOY_COOKIE_SECURE" != "true" ]; then
      echo "错误：HTTPS 地址必须搭配 DEPLOY_COOKIE_SECURE=true"
      exit 1
    fi
    ;;
  *) echo "错误：DEPLOY_PUBLIC_URL 必须以 http:// 或 https:// 开头"; exit 1 ;;
esac

mkdir -p "$UPLOAD_DIR" "$LOCAL_ONLY_DIR"
chmod 700 "$LOCAL_ONLY_DIR"

echo "1/6 正在打包源码（自动排除依赖、缓存、数据库和密钥）……"
tar \
  --exclude='./node_modules' \
  --exclude='./.next' \
  --exclude='./.next-dev' \
  --exclude='./.git' \
  --exclude='./.env' \
  --exclude='./docker.env' \
  --exclude='./docker-data' \
  --exclude='./.DS_Store' \
  --exclude='./tsconfig.tsbuildinfo' \
  --exclude='./prisma/*.db*' \
  --exclude='./public/images/signatures/*' \
  -czf "$UPLOAD_DIR/01-source.tar.gz" \
  -C "$PROJECT_DIR" .

echo "2/6 正在生成 SQLite 一致性数据库快照……"
if [ ! -f "$PROJECT_DIR/prisma/dev.db" ]; then
  echo "错误：没有找到 $PROJECT_DIR/prisma/dev.db"
  exit 1
fi
sqlite3 "$PROJECT_DIR/prisma/dev.db" ".backup '$UPLOAD_DIR/02-prod.db'"
DATABASE_CHECK=$(sqlite3 "$UPLOAD_DIR/02-prod.db" "PRAGMA integrity_check;")
if [ "$DATABASE_CHECK" != "ok" ]; then
  echo "错误：数据库完整性检查没有通过：$DATABASE_CHECK"
  exit 1
fi

echo "3/6 正在打包签章文件……"
SIGNATURE_SOURCE=$(mktemp -d "${TMPDIR:-/tmp}/ecommerce-signatures.XXXXXX")
mkdir -p "$SIGNATURE_SOURCE/signatures"
if [ -d "$PROJECT_DIR/public/images/signatures" ]; then
  cp -R "$PROJECT_DIR/public/images/signatures/." "$SIGNATURE_SOURCE/signatures/"
fi
tar -czf "$UPLOAD_DIR/03-signatures.tar.gz" \
  -C "$SIGNATURE_SOURCE" signatures
rm -rf "$SIGNATURE_SOURCE"

echo "4/6 正在加入服务器配置模板和部署教程……"
awk \
  -v public_url="$DEPLOY_PUBLIC_URL" \
  -v bind_address="$DEPLOY_BIND_ADDRESS" \
  -v port="$DEPLOY_PORT" \
  -v cookie_secure="$DEPLOY_COOKIE_SECURE" \
  '
    /^APP_URL=/ { print "APP_URL=\"" public_url "\""; next }
    /^NEXT_PUBLIC_APP_URL=/ { print "NEXT_PUBLIC_APP_URL=\"" public_url "\""; next }
    /^SESSION_COOKIE_SECURE=/ { print "SESSION_COOKIE_SECURE=\"" cookie_secure "\""; next }
    /^APP_BIND_ADDRESS=/ { print "APP_BIND_ADDRESS=\"" bind_address "\""; next }
    /^APP_PORT=/ { print "APP_PORT=\"" port "\""; next }
    { print }
  ' "$PROJECT_DIR/docker.env.example" > "$UPLOAD_DIR/04-docker.env.example"
chmod 644 "$UPLOAD_DIR/04-docker.env.example"
cp "$PROJECT_DIR/docs/部署运维指南.md" "$UPLOAD_DIR/00-README-宝塔部署教程.md"
cp "$PROJECT_DIR/docs/部署运维指南.md" "$PACKAGE_DIR/00-先看我-阿里云宝塔部署教程.md"

echo "5/6 正在保存本地密钥备份（不会放入上传包）……"
if [ -f "$PROJECT_DIR/.env" ]; then
  cp "$PROJECT_DIR/.env" "$LOCAL_ONLY_DIR/原环境密钥-只用于人工抄写.env.txt"
  chmod 600 "$LOCAL_ONLY_DIR/原环境密钥-只用于人工抄写.env.txt"
else
  printf '%s\n' \
    "本地没有 .env。若数据库中已有加密 AI 配置，部署前必须找回原 AI_CONFIG_ENCRYPTION_KEY。" \
    > "$LOCAL_ONLY_DIR/本地没有env-请先确认AI加密密钥.txt"
  chmod 600 "$LOCAL_ONLY_DIR/本地没有env-请先确认AI加密密钥.txt"
fi

echo "6/6 正在生成校验文件和单文件上传包……"
(
  cd "$UPLOAD_DIR"
  shasum -a 256 \
    "01-source.tar.gz" \
    "02-prod.db" \
    "03-signatures.tar.gz" \
    "04-docker.env.example" \
    > SHA256SUMS.txt
)
tar -czf "$PACKAGE_DIR/上传到服务器-完整资料包.tar.gz" \
  -C "$PACKAGE_DIR" server-upload

echo ""
echo "部署包制作完成："
echo "$PACKAGE_DIR"
echo ""
echo "服务器只上传：上传到服务器-完整资料包.tar.gz"
echo "本地保管-绝对不要上传 目录包含密钥，禁止上传、发送或截图。"
echo "预设访问地址：$DEPLOY_PUBLIC_URL"
echo "容器宿主机监听：$DEPLOY_BIND_ADDRESS:$DEPLOY_PORT"
