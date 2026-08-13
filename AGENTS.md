# AGENTS.md

本项目为 AI 编码助手的项目说明文档。**在任何修改代码/新增功能之前，请先完整阅读本文件。**

## 项目简介

**OhMyMeme-Ultimate** 是 [OhMyMeme](https://github.com/OhMyMeme/OhMyMeme) 的高级版。原项目是 Python 桌面端「轻量化跨平台表情包管理系统」，而本项目的定位是：

> **不再追求轻量化，而是致力于更高级的实现** —— 面向 Web 与桌面的进阶版表情包管理系统，产品体验对标微信/QQ 的表情包面板。

核心目标：在保留原版（导入 / 搜索 / 标签 / 收藏 / 分组 / 一键复制 / 同步）核心能力的基础上，借助现代 Web 技术栈实现更丰富的交互、更强的性能和更优雅的工程化。

## 产品形态：类微信/QQ 表情包管理

界面与交互参考微信/QQ 的表情包面板：网格展示表情、点击即用（复制）、分组/标签快速筛选、收藏夹、最近使用。核心追求是**即时反馈**——所有操作即刻生效、即刻可视化。

## 云优先原则

- **云端为主**：表情包数据与元数据以云端为准，前端（浏览器/桌面壳）只做展示与调用。
- **所有操作云端即时反馈**：导入、删除、打标签、移动分组等操作实时写入服务端并立即反映到界面，不做离线编辑、不与云端产生分歧。
- 前端一切读写都经由服务端 API，客户端不持有独立的持久化状态模型。

## 架构形态：Web 与桌面共享后端 API

项目同时面向 **Web** 与 **桌面** 两个形态：

- **Web 端**：浏览器直接访问，依赖剪贴板、WebSocket 等标准 Web 能力。
- **桌面端**：**复用 Web 的后端 API**，通过 HTTP/WebSocket 与同一套服务端（Nitro）通信。桌面端只承担壳层能力（系统托盘、全局快捷键、本地文件系统访问、原生剪贴板等浏览器受限的能力）。

因此，**服务端 API 是 Web 与桌面共同的核心契约**：所有业务逻辑（数据、图片处理、同步、鉴权）都应收敛在 `server/api` / `server/utils`，前端与桌面客户端只做调用与展示。新增功能时优先以 API 形式提供，而非在客户端内实现。

## 技术栈

| 模块 | 技术 | 说明 |
| --- | --- | --- |
| 框架 | Nuxt 4 (`^4.5.2`) | 服务端渲染 + 全栈能力，`app/` 目录结构 |
| 前端 | Vue 3 (`^3.5`) + Vue Router 5 | Nuxt 内置 |
| 样式 | Tailwind CSS v4 + Nuxt UI v4 (`@nuxt/ui`) | 基于官方 [dashboard 模板](https://github.com/nuxt-ui-templates/dashboard) 复刻，UI 组件统一 `U` 前缀（`UButton` / `UCard` / `UDashboardPanel` 等） |
| 图标 | `@nuxt/icon` + `@iconify-json/lucide` | 统一使用 lucide 图标集，写法 `i-lucide-smile`（Nuxt UI 约定前缀），按需打包 |
| 工具 | `@vueuse/core` + `@vueuse/nuxt` | `useLocalStorage` 等组合式工具 |
| 代码规范 | `@nuxt/eslint@^1.17.0` | flat config，基于 `./.nuxt/eslint.config.mjs` |
| 数据库 | MongoDB（`nuxt-mongoose@^1`，基于 Mongoose 9） | Nuxt 模块自动连接（懒处理，连接失败仅报错不崩溃），连接串 `NUXT_MONGOOSE_URI`；模型放 `server/models/`（`defineMongooseModel` 定义并自动导入） |
| 存储后端 | S3 + 本地（暂时仅这两种） | 服务端 `server/utils` 统一封装，新增存储时只扩展该层 |

## 常用命令

```bash
npm run dev        # 开发服务器
npm run build      # 生产构建
npm run generate   # 静态生成（SSG）
npm run preview    # 预览生产构建
npm run lint       # ESLint 检查（改代码后必须运行）
npm run typecheck  # TS 类型检查（vue-tsc，改代码后建议运行）
npm run migrate:memes  # 数据迁移（旧 `group` 字符串 → `groupId` ObjectId，幂等可重复执行）
npm run postinstall  # = nuxt prepare，生成 .nuxt 类型与 eslint 配置
```

> 修改 `nuxt.config.ts`、`app.config.ts` 或新增页面/组件后，可能需要重新运行 `npm run postinstall`（`nuxt prepare`）以刷新类型。

> [!CAUTION]
> **数据模型变更必须配套迁移**：MongoDB 无 schema 迁移机制，任何字段改名/类型变更（例如本次 `Meme.group: string` → `Meme.groupId: ObjectId`）都必须提供**幂等的迁移脚本**（放 `scripts/`，如 `scripts/migrate-memes.mjs`，用 `node --env-file=.env` 运行），上线前先对存量数据执行迁移，不得直接改动字段导致旧数据不可见。

> [!CAUTION]
> **AI 严禁自行启动 dev 服务器（`npm run dev`）**：不得以任何方式（包括后台进程、`Start-Process` 等）启动开发服务器。验证、测试或联调一律由用户在终端手动运行 `npm run dev`。AI 只允许在用户已自行启动的 dev 服务器上进行请求级验证（如 `curl`）。任务结束前必须确保 AI 未残留任何 dev 相关进程。

## 目录结构约定（Nuxt 4）

Nuxt 4 采用 `app/` 目录布局，源文件位于 `app/` 而非根目录：

```
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
- 服务端 API 路由放在 `server/api/**`，文件名即 URL 路径（如 `server/api/memes.get.ts` → `GET /api/memes`）。
- 数据库访问、鉴权等服务端逻辑放 `server/utils/` 或 `server/services/`。
- 桌面客户端（若为独立仓库/目录）只与 `server/api` 契约交互，不得直接访问数据库或服务端内部模块。
- **列表页 + 详情页同级路由的写法（Nuxt 4.5 路由陷阱）**：`pages/x.vue` 与 `pages/x/[id].vue` 并存时，`[id].vue` 会被 unrouting 生成为 `x.vue` 的**嵌套子路由**，而 `x.vue` 内没有 `<NuxtPage>` 渲染子路由，导致 `/x/:id` 无法进入（点进去渲染的仍是 `x.vue`）。需要"列表页 + 详情页"同级路由时，请用 `pages/x/index.vue` + `pages/x/[id].vue`。当前表情库即为此结构：`app/pages/memes/index.vue`（`/memes` 列表）+ `app/pages/memes/[group].vue`（`/memes/:group` 详情）。

## 配置

- **`nuxt.config.ts`**：模块、兼容性、运行时配置。当前已启用 `@nuxt/ui`、`@nuxt/eslint`、`@vueuse/nuxt`；`@nuxt/icon`、`@nuxt/fonts`、`@nuxtjs/color-mode` 由 Nuxt UI 自动注册（无需显式加入 `modules`）。表情文件存储通过 `nitro.storage.memes` 挂载（`unstorage` 的 `fs` driver，目录由 `NUXT_STORAGE_LOCAL_DIR` 配置，默认 `.data/uploads/memes`），切换 S3 只需改 driver。
- **`.env`**：环境变量（本地配置），已包含 `NUXT_MONGOOSE_URI`。**严禁将密钥/密码写入代码或提交到仓库。**
- **`eslint.config.mjs`**：基于 Nuxt 官方 flat config，继承 `.nuxt/eslint.config.mjs`。

### 关于 Tailwind v4 + Nuxt UI 的注意事项

- 样式入口是 `app/assets/css/main.css`：`@import "tailwindcss";` 后接 `@import "@nuxt/ui";`。
- **图标统一用 `i-lucide-xxx` 写法**（`@nuxt/icon` + `@iconify-json/lucide`），如 `<UIcon name="i-lucide-smile" />` 或组件 `icon` 属性传 `i-lucide-xxx`；Nuxt UI 按需打包。
- **emoji 不传给 `icon` 属性**：`icon` 只接受 iconify 图标名，直接传 emoji（如 `icon: '🎯'`）不会被 `@nuxt/icon` 渲染（会被当作 iconify 图标去加载而失败）。表情类展示请把 emoji 写在 `label`/文本中。
- **避免多色渐变背景**（如 `from-*-500 via-*-400 to-*-500`）与随意自定义色值，保持精致现代风（Linear/Notion 质感：大圆角、柔影、毛玻璃、呼吸感留白）。
- Toast 使用 Nuxt UI 的 `useToast()`（`toast.add({ title, description, color })`），非自定义实现。

## 前端开发约定

- **UI 基于官方 [dashboard 模板](https://github.com/nuxt-ui-templates/dashboard) 复刻**：沿用其 `UDashboardPanel` / `UDashboardSidebar` / `UDashboardNavbar` / `UDashboardToolbar` 等布局组件与侧边栏交互（可折叠、可拖拽宽度）。
- **布局**：`app/layouts/default.vue` 为带侧边栏的 Dashboard 布局（受保护页面默认使用）；`app/layouts/auth.vue` 为纯净布局（无侧边栏，登录页使用）。
- **侧边栏导航**：`default.vue` 中「表情库」为带子级（各分组）的父菜单项，子级指向 `/memes/{group.id}`，父项自身仍指向 `/memes` 主页面（点击父项文字即返回主页面）；分组数据取自 `useMemes().groups`，子级用 `children` 数组挂在导航项上，且**父项设置 `value: 'memes'` 并通过 `v-model` 控制手风琴展开态**——进入 `/memes` 或任一分组页时自动展开分组列表（便于识别当前分组、快速切换），离开时收起。子级 `label` 用**纯文字分组名**（正式上线表情为图片形式，不再用 emoji 当标题）。新增层级导航时沿用此"父级入口 + 子级列表"结构。
- **组件复用机制**：优先拆分可复用组件，任何被两个以上页面/组件使用的 UI 片段都应抽成独立组件。
- **组件行数上限**：单个组件（template + script）不超过 **100~150 行**；超过时拆分到子组件、composables 或 utils，禁止堆砌。
- **必须使用 Nuxt 官方能力**：优先使用 Nuxt 官方提供的 middleware（`app/middleware` 路由中间件、`server/middleware` 服务端中间件）、composables、`useFetch` / `useAsyncData` / `useState` 等内置 API，不自行造轮子或引入替代方案。
- **解决问题先找现成方案**：遇到新需求（复制图片/GIF、图片处理、剪贴板等）时，**先搜索 npm 包 / Nuxt 模块**，确认无现成可用方案后再自研；若调研发现是平台/浏览器能力限制（如浏览器无法原生写入 `image/gif`），在自研实现的同时在代码或提交说明中注明结论。
- **路由中间件**：页面级守卫放 `app/middleware/`，通过文件名即路由中间件名，在页面中 `definePageMeta({ middleware: [...] })` 启用。
- **服务端中间件**：请求级处理（日志、鉴权、请求预处理）放 `server/middleware/`。
- **鉴权**：登录态统一用 `app/composables/useAuth.ts`（`useCookie` 存 token），`login` / `logout` / `isAuthenticated`；受保护页面启用 `auth` 中间件。登录页为 `/`（`auth` 布局），登录后跳 `/dashboard`；`/dashboard`（总览）与 `/memes`（表情库）均需登录。

## 代码风格

- **不加注释**，除非业务需要明确说明（遵守"除非被要求，否则不添加注释"）。
- 遵循 ESLint 规则（`npm run lint` 必须零报错）。提交前运行 `npm run lint` 与 `npm run build` 验证。
- 优先使用 Nuxt 自动导入与 Nuxt UI 组件，保持代码精简。
- 命名：页面/组件 PascalCase，composables 用 `useXxx`，服务端 API 文件用 `xxx.get.ts` / `xxx.post.ts` 等后缀。
- 新增依赖需先确认是否必要；若使用第三方库，遵循既有用法与版本。

## 功能规划（对照原版 OhMyMeme，供后续实现参考）

原版桌面端能力，将以更高级的形态在 Web / 桌面双端实现。**所有业务能力以服务端 API 为核心契约**（见后续 `API.md`），前端与桌面客户端通过 HTTP/WebSocket 调用：

- 表情包：导入 / 搜索 / 标签（多标签交集筛选）/ 收藏 / 自定义分组
- 一键复制：点击表情包复制到剪贴板（GIF 保留动画；Web 端走浏览器剪贴板，桌面端走原生剪贴板）
- 图片处理：WebP 缩放 / 转 GIF / 隐写还原等复制处理模式
- 存储：云端（S3）为主、本地文件系统为辅，统一存储抽象，后续再扩展其他后端
- 自动更新、自定义存储等能力

### GIF 动画复制的双端分工（重要，平台能力限制）

浏览器硬限制：`navigator.clipboard.write()` 的 `ClipboardItem` **无法写入 `image/gif`**（Chrome 仅支持 `text/plain` / `text/html` / `image/png` 及少量新类型），且 QQ/微信等 Windows 原生客户端粘贴时只读位图格式（`CF_DIB` / `CF_BITMAP` / PNG）或文件拖放（`CF_HDROP`），**不解析 `text/html`**。因此：

- **Web 端**（`app/composables/useCopyMeme.ts`）：GIF 采用「`text/html`（内嵌 `data:image/gif` 保动画）+ `image/png`（首帧静态回退）」双表示写入。结果是——粘贴进富文本/网页/Word 等 HTML 目标为**动图**，粘贴进 QQ/微信原生客户端为**静态图**（这是 Web 端可达到的上限）。
- **桌面端**：要「动图贴进 QQ/微信」**必须走原生剪贴板**，写 `image/gif` 字节或 `.gif` 文件到系统剪贴板。落点：Electron 用 `clipboard.writeBuffer({ 'image/gif': buf })` / `clipboard.writeImage(nativeImage)`（需先解码 GIF 动画帧），或写入 `CF_HDROP`；Tauri 用 `clipboard-manager` / `arboard`。GIF 原始字节直接取现有端点 `GET /api/memes/:id/file`（`cache-control: immutable`）。**当前仓库尚无桌面壳目录**，此能力待桌面客户端落地后实现。

> **当前进展**：表情存储暂定为**仅本地**。存储抽象在 `server/utils/storage.ts`（`save`/`read`/`remove`，基于 Nitro 自带的 `unstorage`，`nitro.storage.memes` 挂载，默认目录 `.data/uploads/memes`，由 `NUXT_STORAGE_LOCAL_DIR` 配置），扩展 S3 时只需改 `nuxt.config.ts` 的 driver。分组为独立实体 `server/models/group.schema.ts`（`GroupRecord`，中文名原生支持），表情 `server/models/meme.schema.ts`（`MemeRecord`）以 `groupId: ObjectId` 引用分组。现有 API：`GET/POST /api/groups`（`GET` 返回每组的 `count` 与 `covers` 封面图 URL，聚合取每类最新 4 张）、`PATCH/DELETE /api/groups/:id`（分组增删改）、`GET /api/memes`（按 `group` 分组过滤 + `limit`/`offset` 分页）、`POST /api/memes`（multipart 多文件上传，`groupId`）、`PATCH/DELETE /api/memes/:id`（改名/移动/删除）、`GET /api/memes/:id/file`（流式返回文件，`cache-control: immutable`）、`GET /api/overview`（总数/分组数/存储）。前端已接入 API：`useMemes()` 拉取分组并提供分组/表情的增删改（`refreshNuxtData` 刷新），分组详情页为页码式分页（48/页）；表情卡片用原生 `<img>` 直连文件端点（避免 IPX 二次代理、保留 GIF 动画）。ObjectId 校验统一走 `server/utils/validate.ts` 的 `isValidId`/`requireValidId`（`mongoose.isValidObjectId`）；前端错误解析统一走 `app/utils/error.ts` 的 `getErrorMessage` + `useAsyncAction`。

实现任何功能前先确认与上述规划的关系，保持模块边界清晰（页面 / 组件 / composable / server API / 数据模型分层），并优先以 API 形式暴露。
