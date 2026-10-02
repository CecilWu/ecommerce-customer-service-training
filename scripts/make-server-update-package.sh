#!/bin/sh
set -eu
export LC_ALL=C
export LANG=C

PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
PACKAGE_TIME=$(date +%Y%m%d-%H%M%S)
OUTPUT_ROOT=${PACKAGE_OUTPUT_DIR:-"$PROJECT_DIR/发布包"}
PACKAGE_NAME="电商客服系统-一键更新-$PACKAGE_TIME"
PACKAGE_DIR="$OUTPUT_ROOT/$PACKAGE_NAME"

mkdir -p "$PACKAGE_DIR"

echo "1/4 运行更新前检查……"
cd "$PROJECT_DIR"
npm run typecheck
npm run test:quality
npm run test:integrity

echo "2/4 打包纯源码（不包含数据库、密钥、缓存和签章）……"
tar \
  --exclude='./node_modules' \
  --exclude='./.next' \
  --exclude='./.next-dev' \
  --exclude='./.git' \
  --exclude='./.env' \
  --exclude='./docker.env' \
  --exclude='./docker-data' \
  --exclude='./发布包' \
  --exclude='./.DS_Store' \
  --exclude='./tsconfig.tsbuildinfo' \
  --exclude='./prisma/*.db*' \
  --exclude='./public/images/signatures/*' \
  -czf "$PACKAGE_DIR/01-source.tar.gz" \
  -C "$PROJECT_DIR" .

echo "3/4 加入一键更新脚本和说明……"
cp "$PROJECT_DIR/scripts/server-one-click-update.sh" "$PACKAGE_DIR/一键更新.sh"
chmod 755 "$PACKAGE_DIR/一键更新.sh"
cat > "$PACKAGE_DIR/更新说明.txt" <<'EOF'
电商客服系统阿里云一键更新包

适用服务器目录：/www/wwwroot/ecommerce-training
正式域名：以服务器 docker.env 中的 APP_URL 为准
Docker 内部代理：以服务器 docker.env 中的 APP_BIND_ADDRESS 和 APP_PORT 为准

宝塔操作：
1. 把完整 tar.gz 上传到 /www/wwwroot。
2. 在宝塔终端执行教程提供的两条命令。
3. 脚本会备份源码、数据库、签章和旧镜像，再构建并切换新版本。
4. 健康检查失败会自动回滚。

本更新包不包含 docker.env、线上数据库、签章或 SSL 证书，也不会修改同机运行的其他系统。
EOF
cp "$PROJECT_DIR/docs/部署运维指南.md" "$PACKAGE_DIR/宝塔更新教程.md"
(cd "$PACKAGE_DIR" && shasum -a 256 01-source.tar.gz 一键更新.sh > SHA256SUMS.txt)

echo "4/4 生成单文件上传包……"
tar -czf "$OUTPUT_ROOT/$PACKAGE_NAME.tar.gz" -C "$OUTPUT_ROOT" "$PACKAGE_NAME"

echo ""
echo "一键更新包制作完成："
echo "$OUTPUT_ROOT/$PACKAGE_NAME.tar.gz"
echo ""
echo "只需把这个 tar.gz 上传到阿里云服务器 /www/wwwroot。"
