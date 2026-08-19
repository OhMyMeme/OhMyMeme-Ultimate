# 开发者文档

面向开发者的完整说明：技术栈、仓库结构、命令、配置与发布。使用/部署类内容见 [README.md](README.md)。

## 技术栈

| 模块 | 技术 |
| --- | --- |
| 后端（Rust） | **axum 0.8 + mongodb 3.8 + image**（`rust-server/`，**当前服务端契约的权威实现**；API/WS 与原 Nitro 完全对齐，详见其 `README.md`） |
| 框架（Web 前端，暂缓） | Nuxt 4（SSR + 全栈，`app/` 目录结构） |
| 前端 | Vue 3 + Vue Router 5 + Tailwind CSS v4 + Nuxt UI v4（lucide 图标 `i-lucide-*`） |
| 数据库 | MongoDB，模型字段 camelCase（`groupId`/`storageKey`/`mimeType`/`thumbKey`/`usedAt`/`createdAt`），集合 `groups` / `memes` |
| 鉴权 | 访问密钥登录 → HMAC-SHA256 短期会话令牌（7 天，`Authorization: Bearer` / `?token=`）；Cookie 会话为自洽简化版（原 iron-seal 兼容待补，仅影响 Web 前端） |
| 实时同步 | WebSocket `/ws`：连接下发 `sync` revision、30s 心跳 `ping`、变更广播 `{type, revision, payload}`，断线重连自动补差 |
| 图片处理 | `image` crate：上传即生成 256px WebP 缩略图（GIF 取首帧；仅 lossless，原 sharp 为 lossy q80） |
| 存储 | 本地文件目录（`STORAGE_LOCAL_DIR`，默认 `.data/uploads/memes`），存储键 `{uuid}{ext}` |
| 桌面壳 | Tauri 2（`tray-icon` + `tauri-plugin-global-shortcut` + `windows` crate 原生剪贴板；启动按屏夹取窗口尺寸；全局快捷键显示窗口时切入收藏分组） |
| 工程 | npm workspaces + Turborepo；ESLint（`@nuxt/eslint`）；Rust 侧 cargo（离线构建见 `rust-server/README.md`） |

## 仓库结构

```
rust-server/       # 独立 Rust 后端（axum + MongoDB，cargo 工程，当前契约权威实现）
  src/             # main / config / state / auth / guard / storage / realtime / ws / models / routes
  scripts/         # 离线 vendor 工具（sparse-mirror / vendor-download）与冒烟测试
  docs/            # 联调核对清单
nuxt-app/          # Web workspace（ohmymeme-web）
  app/             # 前端（components / composables / pages / layouts / utils...，开发暂缓）
  server/          # Nitro 服务端（api / middleware / routes / models / utils）——已被 rust-server 替代，保留作对照
  scripts/         # 开发脚本（reset-dev.mjs）
tauri-app/         # 桌面 workspace（ohmymeme-desktop，Tauri + Vue + Vite，壳层）
  src/             # Vue 前端（TitleBar、settings 设置中心、useHeartbeat 等）
  src-tauri/       # Rust 壳层（系统托盘、全局快捷键、原生剪贴板、自建窗口三键）
turbo.json         # Turborepo 任务编排
package.json       # 根（workspaces + turbo 代理脚本）
.npmrc             # legacy-peer-deps=true（桌面端 vite-plugin-vue-layouts 与 vite 6 的 peer 冲突）
```

**服务端 API 是 Web 与桌面共同的核心契约**：业务逻辑（数据、图片处理、同步、鉴权）收敛在后端服务，前端与桌面只做调用与展示。新增服务端能力优先在 `rust-server/` 实现（API 契约需保持与桌面端 `tauri-app/src/composables/*` 及 Web 端调用方兼容）。

## 常用命令

```bash
# 根目录（Turborepo 编排，无需 cd；Nuxt 任务当前被 --filter=!ohmymeme-web 排除）
npm install              # 安装全部依赖（workspaces 统一安装；rust-server 也已接入 workspace）
npm run dev              # 同时启动 Rust 后端（ohmymeme-server）+ 桌面端（ohmymeme-desktop，Tauri）
npm run dev:server       # 仅 Rust 后端（cargo run，默认 :3000）
npm run dev:desktop      # 仅桌面端（Tauri；需先运行后端服务）
npm run dev:desktop:web  # 仅桌面前端（Vite dev，端口 1420，不启动 Tauri 壳）
npm run build            # 生产构建：Rust 后端（cargo --release --offline）+ 桌面端（vue-tsc + vite build）
npm run build:server     # 仅 Rust 后端 release 构建（离线构建需 rust-server/vendor/，见其 README）
npm run build:desktop    # 仅桌面端生产构建
npm run reset:dev        # 一键清除开发数据（node rust-server/scripts/reset-dev.mjs：删 memes/groups 集合 + 清空存储目录；仅本地开发库，含 production/远程库保护）
```

> 修改 `nuxt.config.ts` 或新增页面/组件后，可能需要重新 `npm install`（触发 workspace 的 `postinstall` = `nuxt prepare`）以刷新类型。
> 修改 `tauri-app/src-tauri/`（Cargo.toml / capabilities / tauri.conf.json / lib.rs）后需等待 `tauri dev` 自动重编译（新增 Rust 依赖时首次编译较久）。

## 配置

- **`rust-server/.env`**：`MONGO_URI` / `ACCESS_TOKEN` / `PORT` / `HOST` / `ALLOWED_ORIGINS` / `STORAGE_LOCAL_DIR` / `WEB_ENABLED`（**严禁提交**，含无点变体 `rust-server/env`）。模板见 `.env.example`；契约差异见其 `README.md`。
- **`nuxt-app/.env`**：`NUXT_MONGOOSE_URI` / `NUXT_ACCESS_TOKEN` / `NUXT_SESSION_PASSWORD`（Nuxt 后端对照用，**严禁提交**）。模板见 `.env.example`。
- **`nuxt-app/nuxt.config.ts`**：模块、`runtimeConfig`（`accessToken` / `allowedOrigins`）、`nitro.storage.memes`、`experimental.websocket`、`nitro.externals.external: ['sharp']`（避免原生模块打包失败）。
- **`tauri-app/src-tauri/capabilities/default.json`**：窗口能力权限（拖动 / 最小化 / 最大化 / 还原 / 关闭）。
- **`tauri-app/src-tauri/tauri.conf.json`**：默认窗口 `960×600`（与最小尺寸一致，最小缩放打开）；`decorations: false` 自建标题栏。
- **根 `.npmrc`**：`legacy-peer-deps=true`。

## 开发约定

- 组件 / composables / utils 自动导入（Nuxt），不需要手动 import；单组件不超过 100~150 行。
- 服务端错误统一 `{ statusCode, message }` JSON（Rust 端 `AppError`；Nuxt 端 `createError`，**不用 `statusMessage`**）；前端错误解析读 `data.message`。
- 变更类 API（分组 / 表情增删改）写入后必须广播（Rust 端 `state.realtime.broadcast`），否则多端不同步。
- 数据库 schema「一次设计到位」：MongoDB 无迁移机制，禁止引入迁移脚本；字段名沿用 camelCase（与存量数据一致）。
- 完整规范与 AI 协作约定见 [AGENTS.md](AGENTS.md)（改代码前必读）。

## 发布

- 推送 `v*` tag 触发 `.github/workflows/release.yml`：`build-server`（Rust release 二进制 → 解压即用服务端包）+ `build-desktop`（Windows NSIS）+ `publish`（GitHub Release）。
- 服务端包资源（`rust-server/scripts/start.sh` / `start.bat` / `README.txt` / `.env.example`）需随仓库维护。
- 打包清单、发布前检查与常见问题见 `RELEASE.md`（维护者本地文档，已 gitignore）。

> 当前 `release.yml` 的 `build-web` job 仍按旧的 Nuxt `.output` 打包，尚未改写为 `build-server`（Rust）。发布前请同步 workflow，或在手动模式下按 `RELEASE.md` 第三步打包服务端。
