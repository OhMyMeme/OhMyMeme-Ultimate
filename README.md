# OhMyMeme-Ultimate

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Nuxt](https://img.shields.io/badge/Nuxt-4-00DC82.svg)](https://nuxt.com)
[![Vue](https://img.shields.io/badge/Vue-3-4FC08D.svg)](https://vuejs.org)

[OhMyMeme](https://github.com/OhMyMeme/OhMyMeme) 的高级版 —— 一个更强大的表情包管理器，支持 Web 浏览器和桌面客户端，多设备之间数据实时同步。

## 它能做什么

- **批量导入**：拖入多张图片，自动整理成表情包，支持分组管理与一键重命名
- **点击即用**：点一下就能复制到剪贴板，GIF 动图也能保留动画，复制过的表情自动进入「最近使用」
- **智能分组**：收藏、最近使用（最多 50 条）、未分组自动归类；上传默认放入未分组，也可手动指定分组
- **丝滑浏览**：上传即生成缩略图，上千张表情也能流畅滚动
- **多端同步**：在任何设备上操作，其他设备立刻生效
- **隐私保护**：一个访问密钥就能保护你的表情库

## 快速开始

> 需要：MongoDB（本地安装或使用 [Atlas](https://www.mongodb.com/atlas)）。后端有两种实现，任选其一：

**方式 A：Rust 后端（推荐，当前服务端契约的权威实现）**

> 需要：Rust 工具链（rustup 安装 stable 即可）；若系统 schannel TLS 不可用，cargo 需使用 `rust-server/vendor/` 离线构建（见 `rust-server/README.md`）。

```bash
npm run dev:server   # 仅 Rust 后端（turbo 编排 cargo run，监听 http://0.0.0.0:3000）
# 或直接：
cd rust-server
cp .env.example .env   # 编辑填写 ACCESS_TOKEN（访问密钥）、MONGO_URI
cargo run              # 后端监听 http://0.0.0.0:3000
```

**方式 B：Nuxt 后端（原实现，保留作对照参考）**

```bash
npm install
cp nuxt-app/.env.example nuxt-app/.env   # 编辑填写三个必填项
npm run dev
```

启动后端后，浏览器访问 `http://localhost:3000` 输入访问密钥即可使用；桌面客户端在连接页填入后端地址（默认 `http://localhost:3000`）。

## 下载安装

不想从源码运行？到 [Releases](https://github.com/OhMyMeme/OhMyMeme-Ultimate/releases) 下载最新版本：

- **Windows 桌面客户端**：下载 `.exe` 安装包，双击安装
- **服务端包**：下载 `.zip` 或 `.tar.gz`，解压后按包内说明配置运行（内含 Rust 后端二进制 + 启动脚本 + 配置模板，需自行准备好 MongoDB）

## 环境变量

**Rust 后端**（`rust-server/.env`，见 `rust-server/.env.example`）：

| 变量 | 说明 | 默认 |
| --- | --- | --- |
| `MONGO_URI` | MongoDB 连接地址（必填） | `mongodb://localhost:27017/ohmymeme` |
| `ACCESS_TOKEN` | 登录访问密钥（必填） | — |
| `PORT` / `HOST` | 监听端口 / 地址 | `3000` / `0.0.0.0` |
| `ALLOWED_ORIGINS` | 允许的跨域来源（逗号分隔） | 同源 + 桌面端 |
| `STORAGE_LOCAL_DIR` | 表情文件存储目录 | `.data/uploads/memes` |
| `WEB_ENABLED` | 是否开放 Web 页面（默认关闭，仅 API/WS） | `false` |

**Nuxt 后端**（`nuxt-app/.env`，保留作对照）：`NUXT_MONGOOSE_URI` / `NUXT_ACCESS_TOKEN` / `NUXT_SESSION_PASSWORD` 等（见 `nuxt-app/.env.example`）。

## 限制

- **GIF 复制（Web 端）**：浏览器本身不支持复制 GIF 格式，粘贴进 QQ / 微信等原生聊天窗口时会变成静态图；使用桌面客户端可完整复制 GIF 动画
- **鉴权方式**：采用单密钥登录，适合个人或小团队内网使用

## 更多文档

- 开发者请看 → [DEVELOPER.md](DEVELOPER.md)

## License

[GNU AGPL v3](LICENSE)
