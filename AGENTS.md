# AGENTS.md

本项目为 AI 编码助手的项目说明文档。**在任何修改代码/新增功能之前，请先完整阅读本文件。**

## 项目简介

**OhMyMeme-Ultimate** 是 [OhMyMeme](https://github.com/OhMyMeme/OhMyMeme) 的高级版。原项目是 Python 桌面端「轻量化跨平台表情包管理系统」，而本项目的定位是：

> **不再追求轻量化，而是致力于更高级的实现** —— 面向 Web 与桌面的进阶版表情包管理系统，产品体验对标微信/QQ 的表情包面板。

核心目标：在保留原版（导入 / 搜索 / 标签 / 收藏 / 分组 / 一键复制 / 同步）核心能力的基础上，借助现代 Web 技术栈实现更丰富的交互、更强的性能和更优雅的工程化。

## 当前开发重心（重要）

> **后端已重构为 Rust**：服务端实现迁移到独立 Rust 工程 `rust-server/`（axum + MongoDB，API 契约与原 Nitro 实现完全对齐，桌面端零改动可用，见 `rust-server/README.md` 的契约对照）。切换前 `nuxt-app/server/` 仍保留（未删除）；**待用户确认切换后删除 Nuxt 服务端**。Web（Nuxt）前端开发仍暂缓：不改动 `nuxt-app/app/` 的前端页面/组件/composables（除非明确要求）；新增功能一律以服务端 API 形式提供（Rust 端优先），并同步实现到桌面端。
>
> **Android（移动端）开发已暂停**：`tauri-app` 不再进行 Android 平台相关开发/构建/适配（如 `tauri-app/src-tauri/gen/android` 产物、移动端布局调整等均不再维护），工作重心仅限 Windows 桌面端。

## 产品形态：类微信/QQ 表情包管理

界面与交互参考微信/QQ 的表情包面板：网格展示表情、点击即用（复制）、分组/标签快速筛选、收藏夹、最近使用。核心追求是**即时反馈**——所有操作即刻生效、即刻可视化。

## 云优先原则

- **云端为主**：表情包数据与元数据以云端为准，前端（浏览器/桌面壳）只做展示与调用。
- **所有操作云端即时反馈**：导入、删除、打标签、移动分组等操作实时写入服务端并立即反映到界面，不做离线编辑、不与云端产生分歧。
- 前端一切读写都经由服务端 API，客户端不持有独立的持久化状态模型。

## 仓库结构：monorepo（Web + 桌面双端）

本仓库为 **monorepo**，采用 **npm workspaces + Turborepo** 管理：两个子项目（workspace）各有独立的 `package.json`，依赖统一在根目录安装（单一 `package-lock.json`），任务编排由根目录 `turbo.json` 调度：

```
nuxt-app/                # Web 端 workspace（包名 ohmymeme-web，Nuxt 4 全栈应用）
  app/                   # Nuxt 前端（组件、页面、composables、layouts 等，开发暂缓）
  server/                # Nitro 服务端（API 路由、中间件、模型、工具）——已被 rust-server 替代，待删除
  public/                # 静态资源
  nuxt.config.ts         # Nuxt 配置
tauri-app/               # 桌面端 workspace（包名 ohmymeme-desktop，Tauri + Vue + Vite，壳层）
  src/                   # Vue 前端（复用 Nuxt UI，走 HTTP 调用后端 API）
  src-tauri/             # Rust 壳层（系统托盘、原生剪贴板、全局快捷键等）
  vite.config.ts         # Vite 配置（本地 dev 端口 1420）
rust-server/             # 独立 Rust 后端（axum + MongoDB，cargo 工程；也是 npm workspace「ohmymeme-server」，已接入 turbo 编排）
  src/                   # main/config/state/auth/guard/storage/realtime/ws/models/routes
  scripts/               # 离线 vendor 工具（sparse-mirror / vendor-download）与冒烟测试
  docs/                  # 联调核对清单
  vendor/                # 离线构建依赖（约 282 个 crate，schannel 不可用环境下必需）
package.json             # 根（workspaces + turbo 代理脚本）
turbo.json               # 任务编排（dev/build/lint/typecheck 等）
.npmrc                   # legacy-peer-deps=true（桌面端 vite-plugin-vue-layouts 与 vite 6 的 peer 冲突）
```

- **Rust 后端**（`rust-server/`）：**当前服务端契约的权威实现**，API 与 WS 行为与原 Nitro 实现完全对齐（对照表见 `rust-server/README.md`），桌面端连接地址指向它即可零改动使用。新增服务端能力优先在此实现。
- **Web 端**（`nuxt-app/`）：浏览器直接访问（暂缓），依赖剪贴板、WebSocket 等标准 Web 能力。
- **桌面端**（`tauri-app/`）：**复用后端 API**，通过 HTTP/WS 与后端服务通信。桌面端只承担壳层能力（系统托盘、全局快捷键、本地文件系统访问、原生剪贴板等浏览器受限的能力）。桌面端连接地址由用户在首次启动的连接页（`/connect`）自行输入，存于 `tauri-app/src/composables/useServer.ts` 的 `useStorage("ohmymeme_server_url")`（无默认值，未配置时强制进入连接页）；因服务常部署在云端而软件在本地，地址通常指向云端服务（本地调试可填 `http://localhost:3000`）。

因此，**服务端 API 是 Web 与桌面共同的核心契约**：所有业务逻辑（数据、图片处理、同步、鉴权）都应收敛在 `nuxt-app/server/api` / `nuxt-app/server/utils`，前端与桌面客户端只做调用与展示。新增功能时优先以 API 形式提供，而非在客户端内实现。

> 桌面端依赖后端 API，连接地址由用户自行输入（无默认值）。`npm run dev` 会同时启动 Rust 后端与桌面；若单独 `npm run dev:desktop`，需先运行后端服务（`npm run dev:server`）作为后端，否则无法拉取数据。

## 技术栈

| 模块 | 技术 | 说明 |
| --- | --- | --- |
| 框架 | Nuxt 4 (`^4.5.2`) | 服务端渲染 + 全栈能力，`app/` 目录结构 |
| 前端 | Vue 3 (`^3.5`) + Vue Router 5 | Nuxt 内置 |
| 样式 | Tailwind CSS v4 + Nuxt UI v4 (`@nuxt/ui`) | 基于官方 [dashboard 模板](https://github.com/nuxt-ui-templates/dashboard) 复刻，UI 组件统一 `U` 前缀（`UButton` / `UCard` / `UDashboardPanel` 等）；**设计系统由 `.claude/skills/ui-ux-pro-max` 生成**——primary=rose（`#E11D48` 病毒粉）、neutral=slate、warning=amber，标题 Poppins / 正文 Open Sans（fonts.bunny.net），令牌见 `tauri-app/vite.config.ts`（`ui.colors`）与 `tauri-app/src/assets/css/main.css`（字体 / 暗色背景）；**用户可在设置中心自选主题色 / 中性色**（仅官方 Tailwind 色板，localStorage 持久化，经 `useAppConfig().ui.colors` 运行时切换，见 `tauri-app/src/composables/useTheme.ts`）；弹窗统一走 `src/components/AppModal.vue`（统一形态：标题居左 + 关闭居右 + 三段分隔线；footer 按钮一左一右均分占满、取消居左主操作居右；宽度默认 `w-64`（100% 缩放时 256px = 24px 边距×2 + 208px 内容区，rem 随界面缩放等比放大），弹窗内输入框等元素一律 `w-full` 顶满内容区、保留左右 24px 边距；上传弹窗传 `width-class="w-fit"` 内容自适应；关闭按钮直接置 `open=false` 关闭；圆角用 Nuxt UI 默认） |
| 图标 | `@nuxt/icon` + `@iconify-json/lucide` | 统一使用 lucide 图标集，写法 `i-lucide-smile`（Nuxt UI 约定前缀），按需打包 |
| 工具 | `@vueuse/core` + `@vueuse/nuxt` | `useLocalStorage` 等组合式工具 |
| 代码规范 | `@nuxt/eslint@^1.17.0` | flat config，基于 `./nuxt-app/.nuxt/eslint.config.mjs` |
| 数据库 | MongoDB（`nuxt-mongoose@^1`，基于 Mongoose 9） | Nuxt 模块自动连接（懒处理，连接失败仅报错不崩溃），连接串 `NUXT_MONGOOSE_URI`；模型放 `nuxt-app/server/models/`（`defineMongooseModel` 定义并自动导入） |
| 鉴权 | [`nuxt-auth-utils@^0.5.30`](https://nuxt.com/modules/auth-utils) | 密封 Cookie 会话（`NUXT_SESSION_PASSWORD`）+ 自签名短期会话令牌（HMAC，7 天） |
| 实时同步 | WebSocket（Nitro `nitro.experimental.websocket`） | `server/routes/ws.ts` 定义 `/ws` 端点（含服务端心跳 + 连接时下发 `sync` 版本），`server/utils/realtime.ts` 提供 `broadcastRealtime`（携带自增 `revision`），变更即广播、多端即时刷新、断线重连自动补差 |
| 图片处理 | [sharp](https://sharp.pixelplumbing.com) | 上传即生成 256px WebP 缩略图（`server/utils/storage.ts` 的 `generateThumbnail`，GIF 取首帧），`nitro.externals.external: ['sharp']` 需保留避免打包失败 |
| 存储后端 | S3 + 本地（暂时仅这两种） | 服务端 `nuxt-app/server/utils` 统一封装，新增存储时只扩展该层 |
| 限流 / CORS | 自研内存限流 + CORS 白名单 | `server/utils/rate-limit.ts`（登录 5 次/分、受保护接口 600 次/分，按 IP）、`server/utils/cors.ts`（`NUXT_ALLOWED_ORIGINS` 白名单，内置桌面端来源） |
| 桌面壳 | Tauri 2 + Vue 3 + Vite | `tauri-app/`，走 HTTP 复用后端 API；`tray-icon` feature + `tauri-plugin-global-shortcut`（系统托盘 + 全局快捷键，默认 `Ctrl+Alt+N`，可在设置中自定义） |
| **后端（Rust）** | **axum 0.8 + mongodb 3.8 + image** | **`rust-server/`：服务端契约权威实现**（API/WS 与原 Nitro 完全对齐）；HMAC 会话令牌、内存限流、CORS 白名单、256px WebP 缩略图（lossless）、本地文件存储；详见 `rust-server/README.md` |

## 常用命令

> 根目录 `package.json` 通过 **Turborepo** 编排任务（`turbo run <task>`，带增量缓存）。`rust-server` 已作为 npm workspace（`ohmymeme-server`）接入 turbo，其脚本为 `cargo run` / `cargo build --release --offline`。Nuxt（`ohmymeme-web`）相关任务当前被 `--filter=!ohmymeme-web` 排除，暂不参与编排。

```bash
# 根目录（推荐，无需 cd）
npm run dev            # 同时启动 Rust 后端（ohmymeme-server）与桌面端（ohmymeme-desktop，Tauri）
npm run dev:server     # 仅 Rust 后端（cargo run，默认 :3000，env 见 rust-server/.env.example）
npm run dev:desktop    # 仅桌面端（Tauri；需先运行后端服务）
npm run dev:desktop:web  # 桌面端前端（仅 Vite dev，端口 1420，不启动 Tauri 壳）
npm run build          # 生产构建：Rust 后端（cargo --release --offline）+ 桌面端（vue-tsc + vite build）
npm run build:server   # 仅 Rust 后端 release 构建（离线构建需 rust-server/vendor/，见其 README）
npm run build:desktop  # 仅桌面端生产构建
npm run reset:dev      # 一键清除开发数据（node rust-server/scripts/reset-dev.mjs：删 memes/groups 集合 + 清空存储目录；NODE_ENV=production 或非本地库会拒绝执行）

# 也可在子目录内运行各自的脚本（等同）
cd rust-server && cargo run   # 或 ACCESS_TOKEN=<访问密钥> cargo run（env 见 .env.example）
cd tauri-app && npm run dev
```

> 修改 `nuxt.config.ts`、`app.config.ts` 或新增页面/组件后，可能需要重新运行 `npm install`（触发 workspace 的 `postinstall` = `nuxt prepare`）以刷新类型。

> [!CAUTION]
> **数据库 schema 以「一次设计到位」为目标**：MongoDB 无 schema 迁移机制，字段改名/类型变更成本高且易丢数据。新增字段前先确认是否需要，尽量在 `nuxt-app/server/models/*.schema.ts` 一次性定义完整结构（含索引与 `timestamps`），避免后期迁移。存量数据已为最新结构（`groupId: ObjectId` 引用分组），不存在旧字段数据，**无需也禁止再引入迁移脚本**。

> [!CAUTION]
> **AI 严禁自行启动 dev 服务器（`npm run dev`）**：不得以任何方式（包括后台进程、`Start-Process` 等）启动开发服务器。验证、测试或联调一律由用户在终端手动运行 `npm run dev`。AI 只允许在用户已自行启动的 dev 服务器上进行请求级验证（如 `curl`）。任务结束前必须确保 AI 未残留任何 dev 相关进程。

## 目录结构约定（Nuxt 4）

Nuxt 4 采用 `app/` 目录布局，源文件位于 `nuxt-app/app/` 而非根目录：

```
nuxt-app/
  app/
    app.vue               # 根组件
    assets/               # 样式、图片等静态资源（可被编译处理）
    components/           # 全局自动导入组件（无需手动 import）
    composables/          # 自动导入的 hooks（useXxx）
    layouts/              # 布局组件（default.vue 等）
    pages/                # 页面路由（文件即路由）
    middleware/           # 路由中间件
    plugins/              # Vue/Nuxt 插件
    utils/                # 自动导入的工具函数
    error.vue             # 全局错误页
  server/                 # Nitro 服务端（API 路由 / server/api、中间件、插件）
    api/
    middleware/
    utils/
  public/                 # 静态资源（favicon、robots 等），URL 根路径直接映射
```

- 组件、composables、utils 均**自动导入**，不要在文件中手动 `import`（除非需要显式命名冲突处理）。
- 服务端 API 路由放在 `nuxt-app/server/api/**`，文件名即 URL 路径（如 `nuxt-app/server/api/memes.get.ts` → `GET /api/memes`）。
- 数据库访问、鉴权等服务端逻辑放 `nuxt-app/server/utils/` 或 `nuxt-app/server/services/`。
- 桌面客户端（`tauri-app/`）只与 `server/api` 契约交互，不得直接访问数据库或服务端内部模块。
- **列表页 + 详情页同级路由的写法（Nuxt 4.5 路由陷阱）**：`pages/x.vue` 与 `pages/x/[id].vue` 并存时，`[id].vue` 会被 unrouting 生成为 `x.vue` 的**嵌套子路由**，而 `x.vue` 内没有 `<NuxtPage>` 渲染子路由，导致 `/x/:id` 无法进入（点进去渲染的仍是 `x.vue`）。需要"列表页 + 详情页"同级路由时，请用 `pages/x/index.vue` + `pages/x/[id].vue`。当前表情库即为此结构：`nuxt-app/app/pages/memes/index.vue`（`/memes` 列表）+ `nuxt-app/app/pages/memes/[group].vue`（`/memes/:group` 详情）。桌面端 `tauri-app/src/pages/` 也沿用相同路由结构。

## 配置

- **`nuxt-app/nuxt.config.ts`**：模块、兼容性、运行时配置。当前已启用 `@nuxt/ui`、`@nuxt/eslint`、`@vueuse/nuxt`、`nuxt-mongoose`、`nuxt-auth-utils`；`@nuxt/icon`、`@nuxt/fonts`、`@nuxtjs/color-mode` 由 Nuxt UI 自动注册（无需显式加入 `modules`）。`runtimeConfig.accessToken` 承载访问密钥（由 `NUXT_ACCESS_TOKEN` 注入）、`runtimeConfig.allowedOrigins` 承载 CORS 白名单（由 `NUXT_ALLOWED_ORIGINS` 注入）、`runtimeConfig.webEnabled` 承载 Web 前端开关（由 `NUXT_WEB_ENABLED` 注入，**默认 false 即禁止 Web 页面访问**：`server/middleware/web-disabled.ts` 拦截除 `/api/**`、`/ws`、`/_nuxt/**`、`/_ipx/**` 外的页面请求并返回 403 提示页，API 与 WebSocket 不受影响，桌面端正常使用；开发 Web 前端时临时设 `NUXT_WEB_ENABLED=true` 开启）。表情文件存储通过 `nitro.storage.memes` 挂载（`unstorage` 的 `fs` driver，目录由 `NUXT_STORAGE_LOCAL_DIR` 配置，默认 `.data/uploads/memes`），切换 S3 只需改 driver；`nitro.experimental.websocket` 已启用以支持 `/ws` 实时推送；`nitro.externals.external: ['sharp']` 避免原生模块打包失败。
- **`nuxt-app/.env`**：环境变量（本地配置），已包含 `NUXT_MONGOOSE_URI`、`NUXT_ACCESS_TOKEN`、`NUXT_SESSION_PASSWORD`。**严禁将密钥/密码写入代码或提交到仓库。**
- **`nuxt-app/eslint.config.mjs`**：基于 Nuxt 官方 flat config，继承 `.nuxt/eslint.config.mjs`。
- **根 `turbo.json`**：任务编排。`dev` / `dev:web` 标记为 `persistent`（不缓存、不退出），`build` 输出 `.output` / `dist`。新增任务时在此配置 `cache` / `outputs`。
- **根 `.npmrc`**：`legacy-peer-deps=true`（因 tauri-app 的 `vite-plugin-vue-layouts@0.11` 声明 peer `vite@^4||^5`，而项目实际使用 vite 6）。

### 关于 Tailwind v4 + Nuxt UI 的注意事项

- 样式入口是 `nuxt-app/app/assets/css/main.css`：`@import "tailwindcss";` 后接 `@import "@nuxt/ui";`。
- **图标统一用 `i-lucide-xxx` 写法**（`@nuxt/icon` + `@iconify-json/lucide`），如 `<UIcon name="i-lucide-smile" />` 或组件 `icon` 属性传 `i-lucide-xxx`；Nuxt UI 按需打包。
- **emoji 不传给 `icon` 属性**：`icon` 只接受 iconify 图标名，直接传 emoji（如 `icon: '🎯'`）不会被 `@nuxt/icon` 渲染（会被当作 iconify 图标去加载而失败）。表情类展示请把 emoji 写在 `label`/文本中。
- **避免多色渐变背景**（如 `from-*-500 via-*-400 to-*-500`）与随意自定义色值，保持精致现代风（Linear/Notion 质感：大圆角、柔影、毛玻璃、呼吸感留白）。
- Toast 使用 Nuxt UI 的 `useToast()`（`toast.add({ title, description, color })`），非自定义实现。

## 前端开发约定

- **UI 基于官方 [dashboard 模板](https://github.com/nuxt-ui-templates/dashboard) 复刻**：沿用其 `UDashboardPanel` / `UDashboardSidebar` / `UDashboardNavbar` / `UDashboardToolbar` 等布局组件与侧边栏交互（可折叠、可拖拽宽度）。
- **布局**：`nuxt-app/app/layouts/default.vue` 为带侧边栏的 Dashboard 布局（受保护页面默认使用）；`nuxt-app/app/layouts/auth.vue` 为纯净布局（无侧边栏，登录页使用）。
- **侧边栏导航**：`default.vue` 中「表情库」为带子级（各分组）的父菜单项，子级指向 `/memes/{group.id}`，父项自身仍指向 `/memes` 主页面（点击父项文字即返回主页面）；分组数据取自 `useMemes().groups`，子级用 `children` 数组挂在导航项上，且**父项设置 `value: 'memes'` 并通过 `v-model` 控制手风琴展开态**——进入 `/memes` 或任一分组页时自动展开分组列表（便于识别当前分组、快速切换），离开时收起。子级 `label` 用**纯文字分组名**（正式上线表情为图片形式，不再用 emoji 当标题）。新增层级导航时沿用此"父级入口 + 子级列表"结构。
- **组件复用机制**：优先拆分可复用组件，任何被两个以上页面/组件使用的 UI 片段都应抽成独立组件。
- **组件行数上限**：单个组件（template + script）不超过 **100~150 行**；超过时拆分到子组件、composables 或 utils，禁止堆砌。
- **必须使用 Nuxt 官方能力**：优先使用 Nuxt 官方提供的 middleware（`app/middleware` 路由中间件、`server/middleware` 服务端中间件）、composables、`useFetch` / `useAsyncData` / `useState` 等内置 API，不自行造轮子或引入替代方案。
- **解决问题先找现成方案**：遇到新需求（复制图片/GIF、图片处理、剪贴板等）时，**先搜索 npm 包 / Nuxt 模块**，确认无现成可用方案后再自研；若调研发现是平台/浏览器能力限制（如浏览器无法原生写入 `image/gif`），在自研实现的同时在代码或提交说明中注明结论。
- **路由中间件**：页面级守卫放 `app/middleware/`，通过文件名即路由中间件名，在页面中 `definePageMeta({ middleware: [...] })` 启用。
- **服务端中间件**：请求级处理（日志、鉴权、请求预处理）放 `server/middleware/`。
- **鉴权**：基于 [`nuxt-auth-utils`](https://nuxt.com/modules/auth-utils) 的密封 Cookie 会话 + 自签名的短期会话令牌。用户启动服务时通过 `NUXT_ACCESS_TOKEN`（访问密钥，登录时输入）与 `NUXT_SESSION_PASSWORD`（会话签名密钥，至少 32 字符）配置；`server/api/auth/login.post.ts` 校验密钥后 `setUserSession`（Web 端 Cookie）并返回一个 `createSessionToken()` 生成的**短期会话令牌**（HMAC 签名、7 天过期，见 `server/utils/auth.ts`）。`server/middleware/auth.ts` 与 `server/routes/ws.ts` 保护除 `/api/auth/**`、`/api/_auth/**`、`/api/health` 外的所有 `/api/**`，只接受**会话令牌**（`Authorization: Bearer <会话令牌>` / `?token=<会话令牌>`）或密封 Cookie；**原始访问密钥只在登录接口被接受，不再作为 Bearer/查询参数直接使用**（避免主密钥随每次请求外泄）。该中间件同时承担 **CORS 白名单**（`applyCors`，`server/utils/cors.ts`）与**内存限流**（登录 5 次/分、受保护接口 600 次/分，`server/utils/rate-limit.ts`）。前端登录态统一用 `app/composables/useAuth.ts`（基于 `useUserSession`），`login(token)` / `logout` / `isAuthenticated`；受保护页面启用 `auth` 中间件。登录页为 `/`（`auth` 布局），登录后跳 `/dashboard`；`/dashboard`（总览）与 `/memes`（表情库）均需登录。桌面端鉴权见 `tauri-app/src/composables/useAuth.ts`（`login()` 用访问密钥换取会话令牌存 `useStorage`，`useApi` 带 `Authorization` 头，图片 URL 与 WS 追加 `?token=` 会话令牌）。**服务端错误统一用 `createError({ statusCode, message })`（不再使用 `statusMessage`，h3 已弃用并会告警）；前端错误解析统一读 `data.message`（`app/utils/error.ts` 的 `getErrorMessage`）。**

## 代码风格

- **不加注释**，除非业务需要明确说明（遵守"除非被要求，否则不添加注释"）。
- 遵循 ESLint 规则（`npm run lint` 必须零报错）。提交前运行 `npm run lint` 与 `npm run build` 验证。
- 优先使用 Nuxt 自动导入与 Nuxt UI 组件，保持代码精简。
- 命名：页面/组件 PascalCase，composables 用 `useXxx`，服务端 API 文件用 `xxx.get.ts` / `xxx.post.ts` 等后缀。
- 新增依赖需先确认是否必要；若使用第三方库，遵循既有用法与版本。

## 功能规划（对照原版 OhMyMeme，供后续实现参考）

原版桌面端能力，将以更高级的形态在 Web / 桌面双端实现。**所有业务能力以服务端 API 为核心契约**（见后续 `API.md`），前端与桌面客户端通过 HTTP/WebSocket 调用：

- 表情包：导入 / 搜索 / 标签（多标签交集筛选）/ 收藏 / 最近使用（上限 50）/ 未分组 / 自定义分组
- 一键复制：点击表情包复制到剪贴板（GIF 保留动画；Web 端走浏览器剪贴板，桌面端走原生剪贴板）
- 图片处理：WebP 缩放 / 转 GIF / 隐写还原等复制处理模式
- 存储：云端（S3）为主、本地文件系统为辅，统一存储抽象，后续再扩展其他后端
- 自动更新、自定义存储等能力

### GIF 动画复制的双端分工（重要，平台能力限制）

浏览器硬限制：`navigator.clipboard.write()` 的 `ClipboardItem` **无法写入 `image/gif`**（Chrome 仅支持 `text/plain` / `text/html` / `image/png` 及少量新类型），且 QQ/微信等 Windows 原生客户端粘贴时只读位图格式（`CF_DIB` / `CF_BITMAP` / PNG）或文件拖放（`CF_HDROP`），**不解析 `text/html`**。因此：

- **Web 端**（`nuxt-app/app/composables/useCopyMeme.ts`）：GIF 采用「`text/html`（内嵌 `data:image/gif` 保动画）+ `image/png`（首帧静态回退）」双表示写入。结果是——粘贴进富文本/网页/Word 等 HTML 目标为**动图**，粘贴进 QQ/微信原生客户端为**静态图**（这是 Web 端可达到的上限）。
- **桌面端**（已实现）：`tauri-app/src/composables/useCopyMeme.ts` 拉取 `GET /api/memes/:id/file`（`cache-control: immutable`）字节后，**所有图片（GIF/PNG/JPEG/WebP）统一**经自定义 Tauri 命令 `copy_file_to_clipboard`（`tauri-app/src-tauri/src/lib.rs`）把字节按 `mimeType` 写入对应扩展名的临时文件，并以 `CF_HDROP`（文件拖放）写入 Windows 剪贴板（依赖 `windows` crate 的 `OpenClipboard`/`SetClipboardData`/`GlobalAlloc`，仅 Windows 生效），QQ/微信粘贴即得图片（GIF 保留动画）。非 Tauri 环境回退浏览器 `navigator.clipboard`。**复制成功后**前端调用 `POST /api/memes/:id/use` 记录最近使用（桌面端 `useCopyMeme` 已实现；Web 前端暂缓，未接入）。

> **当前进展**：表情存储暂定为**仅本地**。存储抽象在 `nuxt-app/server/utils/storage.ts`（`save`/`saveThumb`/`read`/`remove` + `sniffMimeType` 魔数校验 + `generateThumbnail` 缩略图，基于 Nitro 自带的 `unstorage`，`nitro.storage.memes` 挂载，默认目录 `.data/uploads/memes`，由 `NUXT_STORAGE_LOCAL_DIR` 配置），扩展 S3 时只需改 `nuxt-app/nuxt.config.ts` 的 driver。分组为独立实体 `nuxt-app/server/models/group.schema.ts`（`GroupRecord`，中文名原生支持，含三个系统分组标记 `isFavorites` / `isRecent` / `isUngrouped`），表情 `nuxt-app/server/models/meme.schema.ts`（`MemeRecord`）以 `groupId: ObjectId` 引用分组，含 `thumbKey`（256px WebP 缩略图存储键）、`favorite`（收藏标记，`{ favorite: 1, createdAt: -1 }` 索引）与 `usedAt`（最近使用时间，`{ usedAt: -1 }` 索引）。
>
> **系统分组（收藏 / 最近使用 / 未分组）**：`ensureSystemGroups()` 惰性 upsert 三个系统分组（名字「收藏」「最近使用」「未分组」均为系统保留名，创建同名分组返回 409），`GET /api/groups` 恒按 **收藏 → 最近使用 → 未分组 → 自定义** 顺序返回，且 `count`/`covers` 各自聚合：
> - **收藏**（`isFavorites`）：聚合 `favorite: true` 的表情；表情收藏后仍留在原分组（`favorite` 布尔），`GET /api/memes?group=<收藏分组id>` 返回全部已收藏表情。
> - **最近使用**（`isRecent`）：聚合 `usedAt` 非空的表情，按 `usedAt` 倒序、**上限 50**（`RECENT_LIMIT`，`count` 亦封顶 50、封面取最近 4 张）；复制表情后前端调用 `POST /api/memes/:id/use` 写入 `usedAt` 并广播 `memes-changed`。
> - **未分组**（`isUngrouped`）：真实 bucket，上传未携带 `groupId` 时自动落入（`getUngroupedGroup()`），可作移动目标。
>
> **不可上传/移动到收藏与最近使用**（`POST /api/memes`、`PATCH /api/memes/:id`、`POST /api/memes/batch` 校验 `isFavorites`/`isRecent` 拒绝；未分组可上传可移动）；**三个系统分组均不可改名/删除**（`PATCH/DELETE /api/groups/:id` 返回 403）。
>
> 现有 API：`GET/POST /api/groups`（`GET` 返回每组的 `count` 与 `covers` 封面图 URL，聚合取每类最新 4 张，`$topN` 实现）、`PATCH/DELETE /api/groups/:id`、`GET /api/memes`（按 `group` 过滤 + `limit`/`offset` 分页，最近使用分组附加 50 上限；支持 `tags` 参数逗号分隔做**交集筛选**、`q` 参数按名称/标签大小写不敏感子串搜索）、`POST /api/memes`（multipart 多文件上传，`groupId` 可选，缺省入未分组；逐文件校验，返回 `{ results: [{ name, status: "created"|"failed", reason }] }`，单个坏文件不阻断整批）、`PATCH/DELETE /api/memes/:id`（改名/移动/收藏切换/整体替换 `tags`（去重去空、单标签 ≤30 字符、上限 20 个），删除时清理原图+缩略图）、`POST /api/memes/:id/use`（记录最近使用）、`GET /api/memes/:id/file`（原图，支持 `Range`，`cache-control: private, immutable`）、`GET /api/memes/:id/thumb`（缩略图，无缩略图时回退原图）、`GET /api/tags`（聚合全部标签及使用次数 `[{ name, count }]`，按次数降序）、`GET /api/overview`（表情总数/收藏数/分组数（不含全部系统分组）/存储占用，5s TTL 缓存）、`GET /api/health`（公开健康检查，心跳检测用）。
> 前端已接入 API：`useMemes()` 拉取分组并提供分组/表情的增删改，分组详情页为**无限滚动**（`useIntersectionObserver` + 底部哨兵，滚动自动加载下一批），内置**搜索框（300ms 防抖）与标签筛选条**（`GET /api/tags` 聚合驱动，可多选交集，编辑标签经 `TagEditorModal` 整体替换后 revision 联动刷新标签条）；表情卡片用原生 `<img>` 直连文件端点（避免 IPX 二次代理），**GIF 用原图 URL 保留动画、其他格式走缩略图**，卡片底部展示前 3 个标签（多余折叠为 `+N`）。上传逻辑收敛在双端 `useUpload.ts`（XHR 字节级进度、客户端预校验、失败逐项展示原因 + 一键重试、按 20 个/100MB 分批限速、单次上限 500 个）。ObjectId 校验统一走 `nuxt-app/server/utils/validate.ts` 的 `isValidId`/`requireValidId`；前端错误解析统一走 `app/utils/error.ts` 的 `getErrorMessage` + `useAsyncAction`。

> **实时同步**：变更类 API（分组/表情增删改）在写入后调用 `broadcastRealtime(type)` 广播（`nuxt-app/server/utils/realtime.ts`，基于 `server/routes/ws.ts` 的 `/ws` 连接池），广播携带**自增 `revision`**；`/ws` 在连接建立时下发 `{ type: 'sync', revision }`，客户端（双端 `useRealtime`）维护 `lastRevision`，收到 `sync` 或变更消息时 revision 落后即全量刷新——**断线重连自动补差，不丢失离线期间的变更**。`server/middleware/auth.ts` 保护 `/ws` 与全部 `/api/**`（除 `/api/auth/**`、`/api/_auth/**`、`/api/health`），WebSocket 连接同样要求会话 Cookie 或 `?token=`。前端订阅见 `nuxt-app/app/composables/useRealtime.ts`（登录后自动建连，收到 `groups-changed`/`memes-changed` 即 `refreshNuxtData`）；桌面端见 `tauri-app/src/composables/useRealtime.ts`（`ws://{server}/ws?token=<会话令牌>`）。新增变更类 API 时记得在写入后广播，避免多端状态不一致。

> **桌面端增强（壳层 + UI）**：自建标题栏（`tauri.conf.json` `decorations: false` + `tauri-app/src/components/TitleBar.vue` 三大键，窗口能力权限在 `src-tauri/capabilities/default.json`：`start-dragging` / `minimize` / `maximize` / `unmaximize` / `toggle-maximize` / `close`），Logo 仅展示在标题栏，侧边栏不再重复放 Logo。
>
> 系统托盘 + 全局快捷键 `Ctrl+Alt+N`（默认值，`src-tauri/src/lib.rs`，设置中心可自定义并录制新组合键，前端 `useGlobalShortcut` 启动时应用存储值）；托盘左键/快捷键切换窗口显隐，关闭按钮为隐藏到托盘，托盘菜单「退出」才真正退出。窗口显隐用 Rust 内部 `MAIN_WINDOW_SHOWN` 原子标志做确定性切换（不依赖 Windows 上不可靠的 `is_focused`）。**全局快捷键语义**：仍是「显示/隐藏」主窗口，但在窗口由隐藏变为显示时，Rust 向 Vue 发出 `open-favorites` 事件，`App.vue` 刷新分组后直接切入**收藏分组**（`/memes/:id`）。
>
> 窗口默认最小尺寸打开（`tauri.conf.json` 默认 `960×600`，与 `minWidth/minHeight` 一致），启动时 `clamp_window_to_monitor` 按主屏逻辑分辨率夹取初始/最小尺寸（`min(960, 屏宽) × min(600, 屏高)`），保证 1080P 及以上（含高 DPI 缩放）不超出屏幕。最小窗口布局（`tauri-app/src/assets/css/main.css` 的 `@media (max-width: 1023px)`）：侧边栏**始终显示**并固定 280px，顶栏侧栏按钮可展开/收起——默认展开（表情库 4 列），收起后侧栏隐藏、表情库切换为 6 列；表情网格列宽按可用宽度动态计算以填满内容区。
>
> 设置中心 `/settings`（服务器地址 / 连接状态心跳 `useHeartbeat` / 主题 / 界面缩放 `uiScale` / 复制行为开关 / 账号与数据 / 关于）；服务器断连专属页 `/disconnected`（心跳离线自动跳转、**不自动重试**——离线后停止自动轮询，由用户点击「立即重试」手动触发，恢复后自动返回，`App.vue` 全局路由守卫）。桌面端界面缩放：`main.css` 按窗口宽度放大根字号（≥1600/1920/2560/3440px），`uiScale` 设置可手动覆盖。

实现任何功能前先确认与上述规划的关系，保持模块边界清晰（页面 / 组件 / composable / server API / 数据模型分层），并优先以 API 形式暴露。
