#!/bin/sh
set -eu

DATA_DIR="/data/prisma"
DATABASE_FILE="${DATA_DIR}/prod.db"
SIGNATURE_DIR="/app/public/images/signatures"

# 容器先以 root 创建并修正挂载目录，然后立即降权为 node 用户运行应用。
if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA_DIR" "$SIGNATURE_DIR"
  chown -R node:node /data "$SIGNATURE_DIR"
  exec gosu node "$0" "$@"
fi

first_start="false"
if [ ! -f "$DATABASE_FILE" ]; then
  first_start="true"
  echo "未发现生产数据库，将创建新数据库。"
fi

npm run preflight
sh /app/docker/repair-sqlite-indexes.sh "$DATABASE_FILE"
npm run db:push

if [ "$first_start" = "true" ] && [ "${INIT_DEMO_DATA:-false}" = "true" ]; then
  echo "正在写入首次演示账号和演示数据。"
  npm run db:seed
fi

echo "数据库准备完成，正在启动 Next.js。"
exec npm run start -- --hostname 0.0.0.0 --port 3000
