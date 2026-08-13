# OhMyMeme-Ultimate

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Nuxt](https://img.shields.io/badge/Nuxt-4-00DC82.svg)](https://nuxt.com)
[![Vue](https://img.shields.io/badge/Vue-3-4FC08D.svg)](https://vuejs.org)

[OhMyMeme](https://github.com/OhMyMeme/OhMyMeme) 的高级版 —— 面向 Web 与桌面的进阶版表情包管理器。

> 不再追求「轻量化」，而是致力于更高级的实现：现代 Web 技术栈、云端优先、即时反馈。

> [!WARNING]
> **鉴权尚未实现**，当前登录仅为占位（无服务端校验）。**暂不建议部署到生产环境**，仅适合本地 / 内网演示。上线前请务必先接入真实鉴权。

## ✨ 特性

- **分组管理**：自定义分组，中文名原生支持，封面图自动聚合展示
- **表情导入**：拖拽 / 多选上传，批量导入，实时进度
- **表情管理**：重命名、移动分组、删除、批量移动 / 批量删除
- **一键复制**：点击表情即复制到剪贴板（GIF 保留动画，见下方说明）
- **总览统计**：表情总数、分组数、存储占用
- **现代 UI**：基于 Nuxt UI 的 Dashboard 布局，深色 / 浅色模式，主题色可切换

## 🛠 技术栈

| 模块 | 技术 |
| --- | --- |
| 框架 | [Nuxt 4](https://nuxt.com)（SSR + 全栈） |
| 前端 | Vue 3 + Vue Router |
| 样式 | Tailwind CSS v4 + [Nuxt UI v4](https://ui.nuxt.com) |
| 数据库 | MongoDB（[nuxt-mongoose](https://github.com/codein-dev/nuxt-mongoose) / Mongoose） |
| 存储 | [unstorage](https://unstorage.unjs.io)（本地 `fs` driver，可无缝切换 S3） |
| 工具 | [@vueuse/core](https://vueuse.org) |

## 🚀 快速开始

### 前置要求

- Node.js ≥ 20
- MongoDB（本地或远程）

### 安装与启动

```bash
# 安装依赖
npm install

# 配置环境变量（复制模板并按需修改）
cp .env.example .env

# 启动开发服务器
npm run dev
```

浏览器访问 `http://localhost:3000`。

## ⚙️ 环境变量

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `NUXT_MONGOOSE_URI` | MongoDB 连接串 | `mongodb://localhost:27017/ohmymeme` |
| `NUXT_STORAGE_LOCAL_DIR` | 表情文件本地存储目录 | `.data/uploads/memes` |
| `NUXT_PUBLIC_SITE_URL` | 站点公开 URL（`nuxt generate` 时用于 OG 图） | — |

## 📖 常用命令

```bash
npm run dev          # 开发服务器
npm run build        # 生产构建
npm run generate     # 静态生成（SSG）
npm run preview      # 预览生产构建
npm run lint         # ESLint 检查
npm run typecheck    # TS 类型检查
npm run migrate:memes # 数据迁移（旧 group 字符串 → groupId ObjectId）
```

## 📁 项目结构

```
app/
  assets/          # 样式等静态资源
  components/      # 全局组件（GroupCoverCard / MemeCard / UploadMemeModal 等）
  composables/     # useAuth / useMemes / useCopyMeme / useOverview 等
  layouts/         # default（Dashboard）/ auth 布局
  pages/           # 页面路由（/、/dashboard、/memes、/memes/:group）
  middleware/      # 路由中间件（auth）
  utils/           # 工具函数（getErrorMessage 等）
server/
  api/             # Nitro API 路由（groups / memes / overview）
  models/          # Mongoose 模型（Group / Meme）
  utils/           # 服务端工具（storage / validate / dto）
scripts/           # 数据迁移脚本
```

## 🔌 核心 API

| 方法 | 端点 | 说明 |
| --- | --- | --- |
| `GET` / `POST` | `/api/groups` | 分组列表（含 `count`、封面图）/ 新建分组 |
| `PATCH` / `DELETE` | `/api/groups/:id` | 重命名 / 删除分组 |
| `GET` | `/api/memes` | 表情列表（按分组过滤 + 分页） |
| `POST` | `/api/memes` | 多文件上传（multipart，`groupId`） |
| `PATCH` / `DELETE` | `/api/memes/:id` | 改名 / 移动 / 删除 |
| `POST` | `/api/memes/batch` | 批量移动 / 删除 |
| `GET` | `/api/memes/:id/file` | 流式返回表情文件 |
| `GET` | `/api/overview` | 总数 / 分组数 / 存储统计 |

## 🗺 路线图

- [x] 分组与表情 CRUD、批量操作、分页
- [x] 一键复制（GIF 双表示写入）
- [x] 总览统计、深色模式
- [ ] 搜索、标签（多标签交集筛选）、收藏、最近使用
- [ ] 图片处理（WebP 缩放 / 转 GIF / 隐写还原）
- [ ] 云端存储（S3）
- [ ] 桌面客户端（原生剪贴板、系统托盘、全局快捷键）
- [ ] 真实鉴权（当前登录为占位实现）

## ⚠️ 已知限制

- **鉴权**：当前登录态为占位实现（未做服务端校验），**仅适合本地 / 内网演示，请勿直接部署到公网**。
- **GIF 复制（Web 端）**：浏览器无法向剪贴板写入 `image/gif`，因此粘贴进网页 / 富文本为动图，粘贴进 QQ / 微信原生客户端为静态图。要保留动画需桌面客户端走原生剪贴板（Electron / Tauri）。
- **存储**：当前仅本地文件系统（`unstorage` 的 `fs` driver），S3 后端待扩展。

## 🙏 致谢

- [OhMyMeme](https://github.com/OhMyMeme/OhMyMeme) —— 原项目
- [Nuxt UI Dashboard 模板](https://github.com/nuxt-ui-templates/dashboard) —— UI 布局参考

## 📄 License

[GNU AGPL v3](LICENSE)
