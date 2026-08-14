# OhMyMeme-Ultimate

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Nuxt](https://img.shields.io/badge/Nuxt-4-00DC82.svg)](https://nuxt.com)
[![Vue](https://img.shields.io/badge/Vue-3-4FC08D.svg)](https://vuejs.org)

[OhMyMeme](https://github.com/OhMyMeme/OhMyMeme) 的高级版 —— 面向 Web 与桌面的进阶版表情包管理器。

> 不再追求「轻量化」，而是致力于更高级的实现：现代 Web 技术栈、云端优先、即时反馈。

> **鉴权**：通过 `NUXT_ACCESS_TOKEN`（访问密钥）+ `NUXT_SESSION_PASSWORD`（会话签名密钥）实现单密钥登录，登录页输入访问密钥即可进入。

## ✨ 特性

- **分组管理**：自定义分组，中文名原生支持，封面图自动聚合展示
- **表情导入**：拖拽 / 多选上传，批量导入，实时进度
- **表情管理**：重命名、移动分组、删除、批量移动 / 批量删除
- **一键复制**：点击表情即复制到剪贴板（GIF 保留动画，见下方说明）
- **实时同步**：多端（Web / 桌面 / 多浏览器标签页）经 WebSocket 实时推送，一处增删改、各处即刻刷新
- **访问鉴权**：单密钥登录，会话经密封 Cookie 持久化，所有 API 与文件接口受保护
- **总览统计**：表情总数、分组数、存储占用
- **现代 UI**：基于 Nuxt UI 的 Dashboard 布局，深色 / 浅色模式，主题色可切换
- **双端形态**：Web 端（`nuxt-app/`）+ 桌面端（`tauri-app/`，Tauri），桌面端复用 Web 后端 API

## 🛠 技术栈

| 模块 | 技术 |
| --- | --- |
| 框架 | [Nuxt 4](https://nuxt.com)（SSR + 全栈） |
| 前端 | Vue 3 + Vue Router |
| 样式 | Tailwind CSS v4 + [Nuxt UI v4](https://ui.nuxt.com) |
| 数据库 | MongoDB（[nuxt-mongoose](https://github.com/codein-dev/nuxt-mongoose) / Mongoose） |
| 鉴权 | [nuxt-auth-utils](https://nuxt.com/modules/auth-utils)（密封 Cookie 会话 + HMAC 签名短期会话令牌） |
| 实时同步 | WebSocket（Nitro `experimental.websocket`，`/ws`） |
| 存储 | [unstorage](https://unstorage.unjs.io)（本地 `fs` driver，可无缝切换 S3） |
| 工具 | [@vueuse/core](https://vueuse.org) |

## 🚀 快速开始

> 本仓库为 monorepo：**npm workspaces + Turborepo**。`nuxt-app/`（Web 端，唯一后端）、`tauri-app/`（桌面端，Tauri）。根目录一条命令即可启动，无需 `cd` 进子目录。

### 前置要求

- Node.js ≥ 20
- MongoDB（本地或远程）
- 桌面端另需 Rust / Tauri 环境（仅开发 `tauri-app/` 时需要）

### 安装与启动

```bash
# 在仓库根安装全部依赖（workspaces 统一安装，单一 package-lock.json）
npm install

# 配置环境变量（复制模板并按需修改）
cp nuxt-app/.env.example nuxt-app/.env

# 同时启动 Web 与桌面（主应用双端）
npm run dev
```

浏览器访问 `http://localhost:3000`（Web），桌面端（Tauri）会同时弹出窗口。

> 桌面端首次启动需在连接页自行填写服务端地址（Web 常部署在云端），本地调试填 `http://localhost:3000`，并填写访问密钥。

## 📦 部署（Release 解压即用）

维护者打 `v*` tag 后，GitHub Actions 会自动构建并发布到 **GitHub Releases**：

- **Web 服务**：`npm run build:web` 产出 `.output`，打包为 `ohmymeme-ultimate-*.zip` + `.tar.gz`，解压即用（详见下方）。
- **桌面端**：Windows 环境构建 Tauri 安装包（`desktop_*-setup.exe` / `.msi`）。

用户无需克隆源码、无需 `npm install`。

### 用户侧：下载解压即用

1. 从 [Releases](https://github.com/OhMyMeme/OhMyMeme-Ultimate/releases) 下载 `ohmymeme-ultimate-*.zip` 并解压。
2. 确保已安装 **Node.js ≥ 20**（仅需运行时，无需 `npm install`）。
3. 准备好 **MongoDB**（本地或 [MongoDB Atlas](https://www.mongodb.com/atlas) 云数据库）。
4. 将 `.env.example` 复制为 `.env`，填写 `NUXT_MONGOOSE_URI`、`NUXT_ACCESS_TOKEN`（访问密钥）、`NUXT_SESSION_PASSWORD`（会话签名密钥）。
5. 启动：
   - Windows：双击 `start.bat`
   - Linux / macOS：`./start.sh`
   - 或命令行：`node start.mjs`
6. 访问 `http://localhost:3000`。

> 编译产物（`.output`）已内置全部运行时依赖，上传的表情文件保存在解压目录下的 `.data/uploads/memes`。

### 从源码运行（开发者）

```bash
npm install          # 仓库根安装全部依赖（workspaces）
npm run dev          # 开发服务器
npm run build:web    # Web 生产构建（产出 nuxt-app/.output）
node nuxt-app/.output/server/index.mjs   # 运行生产构建

npm run build:desktop  # 桌面端生产构建（仅 Vite 前端产物）
cd tauri-app && npm run tauri build   # 完整 Tauri 打包（Rust + 安装包，需要 Rust 环境）
```

> 注意本项目依赖常驻的 Node 服务端与 MongoDB，**不支持** `npm run generate` 的纯静态托管。

## ⚙️ 环境变量

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `NUXT_MONGOOSE_URI` | MongoDB 连接串（运行时，必填） | `mongodb://localhost:27017/ohmymeme` |
| `NUXT_ACCESS_TOKEN` | 登录访问密钥（运行时，必填），登录页输入该字符串 | — |
| `NUXT_SESSION_PASSWORD` | 会话签名密钥（运行时，必填，至少 32 字符），用于加密会话 Cookie | — |
| `PORT` | 监听端口 | `3000` |
| `HOST` | 监听地址 | `0.0.0.0` |
| `NUXT_STORAGE_LOCAL_DIR` | 表情文件存储目录（**构建时**生效，仅开发者） | `.data/uploads/memes` |

> 生成密钥示例：访问密钥 `node -e "console.log(require('crypto').randomBytes(128).toString('hex'))"`；会话密钥 `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`。

## 📖 常用命令

```bash
# 仓库根（Turborepo 编排，无需 cd）
npm run dev            # 同时启动 Web（ohmymeme-web）与桌面（Tauri）
npm run dev:web        # 仅 Web 开发服务器
npm run dev:desktop    # 仅桌面端（Tauri，需先运行 dev:web 提供后端）
npm run dev:desktop:web  # 桌面端前端（仅 Vite dev，不启动 Tauri 壳）
npm run build:web      # Web 生产构建
npm run build:desktop  # 桌面端生产构建
npm run lint           # ESLint 检查（两个 workspace）
npm run typecheck      # TS 类型检查

# 或直接进入子目录（等同）
cd nuxt-app && npm run dev          # Web 开发服务器
cd tauri-app && npm run dev         # 桌面端（Tauri）
```

## 📁 项目结构

```
nuxt-app/              # Web 端 workspace（ohmymeme-web，Nuxt 4，唯一后端）
  app/
    assets/          # 样式等静态资源
    components/      # 全局组件（GroupCoverCard / MemeCard / UploadMemeModal 等）
    composables/     # useAuth / useMemes / useCopyMeme / useOverview / useRealtime 等
    layouts/         # default（Dashboard）/ auth 布局
    pages/           # 页面路由（/、/dashboard、/memes、/memes/:group）
    middleware/      # 路由中间件（auth）
    utils/           # 工具函数（getErrorMessage 等）
  server/
    api/             # Nitro API 路由（auth / groups / memes / overview）
    middleware/      # 服务端鉴权中间件（auth）
    routes/          # WebSocket 端点（/ws）
    models/          # Mongoose 模型（Group / Meme）
    utils/           # 服务端工具（storage / validate / auth / realtime 等）
tauri-app/             # 桌面端 workspace（ohmymeme-desktop，Tauri + Vue + Vite）
  src/               # Vue 前端（复用 Nuxt UI，走 HTTP 调用后端 API）
  src-tauri/         # Rust 壳层（系统托盘、原生剪贴板、全局快捷键等）
turbo.json             # Turborepo 任务编排
.npmrc                 # legacy-peer-deps=true（桌面端 peer 冲突）
```

## 🔌 核心 API

| 方法 | 端点 | 说明 |
| --- | --- | --- |
| `POST` | `/api/auth/login` | 提交访问密钥，成功后返回短期会话令牌并建立密封 Cookie 会话 |
| `GET` | `/api/auth/status` | 查询服务端鉴权配置与会话状态（公开） |
| `GET` / `POST` | `/api/groups` | 分组列表（含 `count`、封面图）/ 新建分组 |
| `PATCH` / `DELETE` | `/api/groups/:id` | 重命名 / 删除分组 |
| `GET` | `/api/memes` | 表情列表（按分组过滤 + 分页） |
| `POST` | `/api/memes` | 多文件上传（multipart，`groupId`） |
| `PATCH` / `DELETE` | `/api/memes/:id` | 改名 / 移动 / 删除 |
| `POST` | `/api/memes/batch` | 批量移动 / 删除 |
| `GET` | `/api/memes/:id/file` | 流式返回表情文件 |
| `GET` | `/api/overview` | 总数 / 分组数 / 存储统计 |
| `WS` | `/ws` | 实时同步推送（分组 / 表情变更广播，客户端订阅后自动刷新） |

> 除 `/api/auth/**` 与 `/api/_auth/**` 外，所有接口均需鉴权：Web 端走密封 Cookie 会话，桌面端在连接页用访问密钥换取**短期会话令牌**（HMAC 签名、7 天过期）后，经 `Authorization: Bearer <会话令牌>` 请求头或 `?token=<会话令牌>` 查询参数访问。**原始访问密钥仅用于登录接口，不随业务请求传输。** `/ws` 同样鉴权，WebSocket 连接经 Cookie 或 `?token=` 校验。

> **实时同步机制**：服务端所有变更类 API（`groups` / `memes` 的增删改）在写入后调用 `broadcastRealtime()` 推送 `groups-changed` / `memes-changed` 事件（见 `nuxt-app/server/utils/realtime.ts`）；Web 端 `useRealtime()`（`nuxt-app/app/composables/useRealtime.ts`）与桌面端 `useRealtime()`（`tauri-app/src/composables/useRealtime.ts`）监听后触发 `refreshNuxtData` / 数据刷新，实现多端即时同步。
## 🗺 路线图

- [x] 分组与表情 CRUD、批量操作、分页
- [x] 一键复制（GIF 双表示写入）
- [x] 总览统计、深色模式
- [x] 实时同步（WebSocket 广播，多端即时刷新）
- [ ] 搜索、标签（多标签交集筛选）、收藏、最近使用
- [ ] 图片处理（WebP 缩放 / 转 GIF / 隐写还原）
- [ ] 云端存储（S3）
- [x] 桌面端原生剪贴板（所有图片经临时文件 + `CF_HDROP` 文件拖放复制，GIF 保留动画）
- [x] 单密钥访问鉴权（`nuxt-auth-utils` 密封 Cookie 会话 + 短期签名会话令牌）
- [ ] 系统托盘、全局快捷键等桌面原生能力

## ⚠️ 已知限制

- **鉴权模型**：单密钥登录（共享密钥），适合单人 / 内网使用，非多用户账号体系。
- **GIF 复制（Web 端）**：浏览器无法向剪贴板写入 `image/gif`，因此粘贴进网页 / 富文本为动图，粘贴进 QQ / 微信原生客户端为静态图。要保留动画需桌面客户端（`tauri-app/`）走原生剪贴板（Tauri）。
- **存储**：当前仅本地文件系统（`unstorage` 的 `fs` driver），S3 后端待扩展。

## 🙏 致谢

- [OhMyMeme](https://github.com/OhMyMeme/OhMyMeme) —— 原项目
- [Nuxt UI Dashboard 模板](https://github.com/nuxt-ui-templates/dashboard) —— UI 布局参考

## 📄 License

[GNU AGPL v3](LICENSE)
