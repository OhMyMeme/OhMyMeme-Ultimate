# 开发者文档

面向开发者的完整说明：技术栈、仓库结构、命令、配置与发布。使用/部署类内容见 [README.md](README.md)。

## 技术栈

| 模块 | 技术 |
| --- | --- |
| 框架 | Nuxt 4（SSR + 全栈，`app/` 目录结构） |
| 前端 | Vue 3 + Vue Router 5 + Tailwind CSS v4 + Nuxt UI v4（lucide 图标 `i-lucide-*`） |
| 数据库 | MongoDB（`nuxt-mongoose` / Mongoose 9），模型在 `nuxt-app/server/models/` |
| 鉴权 | `nuxt-auth-utils` 密封 Cookie 会话 + HMAC 短期会话令牌（7 天） |
| 实时同步 | Nitro WebSocket（`/ws`），广播携带自增 `revision`，断线重连自动补差 |
| 图片处理 | sharp（上传即生成 256px WebP 缩略图，GIF 取首帧） |
| 存储 | `unstorage` fs driver（`nitro.storage.memes`，目录 `NUXT_STORAGE_LOCAL_DIR`），可切 S3 |
| 桌面壳 | Tauri 2（`tray-icon` + `tauri-plugin-global-shortcut` + `windows` crate 原生剪贴板；启动按屏夹取窗口尺寸；全局快捷键显示窗口时切入收藏分组） |
| 工程 | npm workspaces + Turborepo；ESLint（`@nuxt/eslint`） |

## 仓库结构

```
nuxt-app/          # Web workspace（ohmymeme-web，唯一后端）
  app/             # 前端（components / composables / pages / layouts / utils...）
  server/          # Nitro 服务端（api / middleware / routes / models / utils）
  scripts/         # 开发脚本（reset-dev.mjs）
tauri-app/         # 桌面 workspace（ohmymeme-desktop，Tauri + Vue + Vite，壳层）
  src/             # Vue 前端（TitleBar、settings 设置中心、useHeartbeat 等）
  src-tauri/       # Rust 壳层（系统托盘、全局快捷键、原生剪贴板、自建窗口三键）
turbo.json         # Turborepo 任务编排
package.json       # 根（workspaces + turbo 代理脚本）
.npmrc             # legacy-peer-deps=true（桌面端 vite-plugin-vue-layouts 与 vite 6 的 peer 冲突）
```

**服务端 API 是 Web 与桌面共同的核心契约**：所有业务逻辑（数据、图片处理、同步、鉴权）收敛在 `nuxt-app/server/`，前端与桌面只做调用与展示。新增功能优先以 API 形式提供。

## 常用命令

```bash
# 根目录（Turborepo 编排，无需 cd）
npm install              # 安装全部依赖（workspaces 统一安装）
npm run dev              # 同时启动 Web 与桌面（Tauri）
npm run dev:web          # 仅 Web 开发服务器
npm run dev:desktop      # 仅桌面端（需先运行 dev:web 提供后端）
npm run dev:desktop:web  # 仅桌面前端（Vite dev，端口 1420，不启动 Tauri 壳）
npm run lint             # ESLint 检查（改代码后必须运行）
npm run typecheck        # TS 类型检查
npm run build:web        # Web 生产构建（产出 nuxt-app/.output）
npm run build:desktop    # 桌面端生产构建
npm run reset:dev        # 一键清除开发数据（memes/groups 集合 + 上传文件夹，仅开发环境，含生产/远程库保护）
```

> 修改 `nuxt.config.ts` 或新增页面/组件后，可能需要重新 `npm install`（触发 workspace 的 `postinstall` = `nuxt prepare`）以刷新类型。
> 修改 `tauri-app/src-tauri/`（Cargo.toml / capabilities / tauri.conf.json / lib.rs）后需等待 `tauri dev` 自动重编译（新增 Rust 依赖时首次编译较久）。

## 配置

- **`nuxt-app/.env`**：`NUXT_MONGOOSE_URI` / `NUXT_ACCESS_TOKEN` / `NUXT_SESSION_PASSWORD`（**严禁提交**）。模板见 `.env.example`。
- **`nuxt-app/nuxt.config.ts`**：模块、`runtimeConfig`（`accessToken` / `allowedOrigins`）、`nitro.storage.memes`、`experimental.websocket`、`nitro.externals.external: ['sharp']`（避免原生模块打包失败）。
- **`tauri-app/src-tauri/capabilities/default.json`**：窗口能力权限（拖动 / 最小化 / 最大化 / 还原 / 关闭）。
- **`tauri-app/src-tauri/tauri.conf.json`**：默认窗口 `960×600`（与最小尺寸一致，最小缩放打开）；`decorations: false` 自建标题栏。
- **根 `.npmrc`**：`legacy-peer-deps=true`。

## 开发约定

- 组件 / composables / utils 自动导入（Nuxt），不需要手动 import；单组件不超过 100~150 行。
- 服务端错误统一 `createError({ statusCode, message })`（**不用 `statusMessage`**，h3 已弃用）；前端错误解析读 `data.message`。
- 变更类 API（分组 / 表情增删改）写入后必须 `broadcastRealtime(type)` 广播，否则多端不同步。
- 数据库 schema「一次设计到位」：MongoDB 无迁移机制，禁止引入迁移脚本。
- 完整规范与 AI 协作约定见 [AGENTS.md](AGENTS.md)（改代码前必读）。

## 发布

- 推送 `v*` tag 触发 `.github/workflows/release.yml`：`build-web`（`.output` 打包解压即用）+ `build-desktop`（Windows NSIS/MSI）+ `publish`（GitHub Release）。
- 打包清单、发布前检查与常见问题见 `RELEASE.md`（维护者本地文档，已 gitignore）。
