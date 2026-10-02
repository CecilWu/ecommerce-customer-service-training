#!/bin/zsh
set -e

PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
"$PROJECT_DIR/scripts/make-server-update-package.sh"

echo ""
echo "按任意键关闭此窗口。"
read -k 1
