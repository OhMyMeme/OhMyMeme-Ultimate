#!/usr/bin/env sh
# OhMyMeme 服务端启动脚本（Linux / macOS）
# 用法：./start.sh   （需已配置同目录 .env，或通过环境变量传入）
cd "$(dirname "$0")"

# 从同目录 .env 加载配置（若存在）
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

exec ./ohmymeme-server
