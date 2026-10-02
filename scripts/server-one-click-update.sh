#!/bin/sh
set -eu

TARGET_DIR="${1:-/www/wwwroot/ecommerce-training}"
PACKAGE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
SOURCE_ARCHIVE="$PACKAGE_DIR/01-source.tar.gz"
SERVICE_NAME="ecommerce-cs-training"
IMAGE_NAME="ecommerce-cs-training:latest"
UPDATE_TIME=$(date +%Y%m%d-%H%M%S)
BACKUP_ROOT="/www/backup/ecommerce-training"
BACKUP_DIR="$BACKUP_ROOT/update-$UPDATE_TIME"
ROLLBACK_IMAGE="ecommerce-cs-training:rollback-$UPDATE_TIME"
SWITCH_STARTED="false"

say() {
  printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$1"
}

compose() {
  docker compose --env-file "$TARGET_DIR/docker.env" -f "$TARGET_DIR/docker-compose.yml" "$@"
}

require_file() {
  if [ ! -f "$1" ]; then
    echo "错误：缺少文件 $1" >&2
    exit 1
  fi
}

clear_source_tree() {
  for item in app components css docker docs lib prisma public scripts; do
    if [ -e "$TARGET_DIR/$item" ]; then
      rm -rf -- "$TARGET_DIR/$item"
    fi
  done
  for item in Dockerfile README.md docker-compose.yml docker.env.example package.json package-lock.json tsconfig.json next.config.mjs next-env.d.ts .dockerignore .env.example .gitignore 一键启动系统.command 制作宝塔Docker部署包.command 制作阿里云一键更新包.command; do
    rm -f -- "$TARGET_DIR/$item"
  done
}

restore_source() {
  say "恢复更新前源码"
  clear_source_tree
  tar -xzf "$BACKUP_DIR/previous-source.tar.gz" -C "$TARGET_DIR"
}

restore_data() {
  if [ -f "$BACKUP_DIR/prisma-data.tar.gz" ]; then
    rm -rf -- "$TARGET_DIR/docker-data/prisma"
    mkdir -p "$TARGET_DIR/docker-data"
    tar -xzf "$BACKUP_DIR/prisma-data.tar.gz" -C "$TARGET_DIR/docker-data"
  fi
  if [ -f "$BACKUP_DIR/signatures-data.tar.gz" ]; then
    rm -rf -- "$TARGET_DIR/docker-data/signatures"
    mkdir -p "$TARGET_DIR/docker-data"
    tar -xzf "$BACKUP_DIR/signatures-data.tar.gz" -C "$TARGET_DIR/docker-data"
  fi
}

rollback() {
  say "新版本未通过健康检查，开始自动回滚"
  compose stop "$SERVICE_NAME" >/dev/null 2>&1 || true
  if docker image inspect "$ROLLBACK_IMAGE" >/dev/null 2>&1; then
    docker tag "$ROLLBACK_IMAGE" "$IMAGE_NAME"
  fi
  restore_source
  if [ "$SWITCH_STARTED" = "true" ]; then
    restore_data
  fi
  compose up -d --no-build --force-recreate
  echo "已恢复旧版本。备份目录：$BACKUP_DIR"
}

say "检查更新包和目标目录"
case "$TARGET_DIR" in
  /*) ;;
  *) echo "错误：项目目录必须填写绝对路径" >&2; exit 1 ;;
esac
case "$TARGET_DIR" in
  /|/www|/www/wwwroot) echo "错误：拒绝把服务器根目录或网站根目录作为更新目标" >&2; exit 1 ;;
esac
require_file "$SOURCE_ARCHIVE"
require_file "$PACKAGE_DIR/SHA256SUMS.txt"
require_file "$TARGET_DIR/docker-compose.yml"
require_file "$TARGET_DIR/docker.env"
require_file "$TARGET_DIR/Dockerfile"
require_file "$TARGET_DIR/package.json"
command -v docker >/dev/null 2>&1 || { echo "错误：服务器没有安装 Docker" >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "错误：Docker Compose 不可用" >&2; exit 1; }
docker info >/dev/null 2>&1 || { echo "错误：Docker 服务未运行。请先在宝塔中启动 Docker。" >&2; exit 1; }
compose config -q
if ! compose config --services | grep -qx "$SERVICE_NAME"; then
  echo "错误：目标目录不是电商客服系统，未找到服务 $SERVICE_NAME" >&2
  exit 1
fi
APP_PUBLIC_URL=$(grep '^APP_URL=' "$TARGET_DIR/docker.env" | head -n 1 | cut -d= -f2- | tr -d '"')
case "$APP_PUBLIC_URL" in
  https://*) ;;
  *)
    echo "错误：docker.env 中的 APP_URL 必须是正式 HTTPS 地址。" >&2
    echo "请先确认目标目录和域名配置；更新脚本不会覆盖 docker.env。" >&2
    exit 1
    ;;
esac

AVAILABLE_KB=$(df -Pk "$TARGET_DIR" | awk 'NR==2 {print $4}')
if [ "${AVAILABLE_KB:-0}" -lt 2097152 ]; then
  echo "错误：可用磁盘不足 2GB，先清理空间再更新。" >&2
  exit 1
fi

say "校验更新包完整性"
(cd "$PACKAGE_DIR" && sha256sum -c SHA256SUMS.txt)

say "创建更新前备份"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
cp "$TARGET_DIR/docker.env" "$BACKUP_DIR/docker.env"
chmod 600 "$BACKUP_DIR/docker.env"
tar \
  --exclude='./node_modules' \
  --exclude='./.next' \
  --exclude='./.next-dev' \
  --exclude='./.git' \
  --exclude='./docker.env' \
  --exclude='./docker-data' \
  --exclude='./tsconfig.tsbuildinfo' \
  -czf "$BACKUP_DIR/previous-source.tar.gz" \
  -C "$TARGET_DIR" .

if docker image inspect "$IMAGE_NAME" >/dev/null 2>&1; then
  docker tag "$IMAGE_NAME" "$ROLLBACK_IMAGE"
elif docker inspect "$SERVICE_NAME" >/dev/null 2>&1; then
  CURRENT_IMAGE_ID=$(docker inspect --format '{{.Image}}' "$SERVICE_NAME")
  docker tag "$CURRENT_IMAGE_ID" "$ROLLBACK_IMAGE"
fi

say "替换程序源码（保留 docker.env、数据库、签章和宝塔配置）"
clear_source_tree
if ! tar -xzf "$SOURCE_ARCHIVE" -C "$TARGET_DIR"; then
  echo "源码解压失败，恢复更新前源码。" >&2
  restore_source
  exit 1
fi
if [ ! -f "$TARGET_DIR/docker-compose.yml" ] || [ ! -f "$TARGET_DIR/Dockerfile" ]; then
  echo "更新包源码不完整，恢复更新前源码。" >&2
  restore_source
  exit 1
fi

say "构建新镜像，旧容器在构建期间继续提供服务"
if ! COMPOSE_PARALLEL_LIMIT=1 compose build "$SERVICE_NAME"; then
  echo "新镜像构建失败，线上旧容器未停止。" >&2
  restore_source
  exit 1
fi

say "预检 Docker 端口映射，避免 iptables 异常导致停服后无法启动"
NETWORK_CHECK_NAME="ecommerce-update-network-check-$UPDATE_TIME"
if ! NETWORK_CHECK_ID=$(docker run -d --rm --name "$NETWORK_CHECK_NAME" --entrypoint /bin/sh -p 127.0.0.1::3000 "$IMAGE_NAME" -c 'sleep 20'); then
  echo "Docker 端口映射预检失败，旧容器仍在运行，本次更新已取消。" >&2
  echo "请先检查 Docker 的 iptables/DOCKER 链，不要停止当前业务容器。" >&2
  restore_source
  exit 1
fi
docker rm -f "$NETWORK_CHECK_ID" >/dev/null 2>&1 || true

say "短暂停止电商客服容器并备份最新业务数据"
if ! compose stop "$SERVICE_NAME"; then
  echo "旧容器停止失败，更新已取消。" >&2
  restore_source
  exit 1
fi
SWITCH_STARTED="true"
if ! mkdir -p "$TARGET_DIR/docker-data/prisma" "$TARGET_DIR/docker-data/signatures" \
  || ! tar -czf "$BACKUP_DIR/prisma-data.tar.gz" -C "$TARGET_DIR/docker-data" prisma \
  || ! tar -czf "$BACKUP_DIR/signatures-data.tar.gz" -C "$TARGET_DIR/docker-data" signatures; then
  echo "业务数据备份失败，立即恢复旧版本。" >&2
  rollback
  exit 1
fi

say "启动新版本"
if ! compose up -d --no-build --force-recreate "$SERVICE_NAME"; then
  rollback
  exit 1
fi

say "等待容器健康检查"
HEALTHY="false"
ATTEMPT=1
while [ "$ATTEMPT" -le 90 ]; do
  STATUS=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$SERVICE_NAME" 2>/dev/null || echo missing)
  if [ "$STATUS" = "healthy" ] || [ "$STATUS" = "running" ]; then
    HEALTHY="true"
    break
  fi
  if [ "$STATUS" = "unhealthy" ] || [ "$STATUS" = "exited" ] || [ "$STATUS" = "dead" ] || [ "$STATUS" = "missing" ]; then
    break
  fi
  sleep 2
  ATTEMPT=$((ATTEMPT + 1))
done

if [ "$HEALTHY" != "true" ]; then
  compose logs --tail=120 "$SERVICE_NAME" || true
  rollback
  exit 1
fi

say "更新完成"
compose ps || true
echo ""
echo "正式访问地址：$APP_PUBLIC_URL"
echo "本次备份目录：$BACKUP_DIR"
echo "回滚镜像：$ROLLBACK_IMAGE"
echo "docker.env、线上数据库、签章、域名、SSL和其他系统均未被替换。"
