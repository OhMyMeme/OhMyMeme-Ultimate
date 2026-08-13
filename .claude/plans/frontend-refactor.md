# OhMyMeme-Ultimate 前端重构计划（精致现代风）

## 目标
在不引入 server 端的前提下，把现有前端从「默认 Nuxt UI 脚手架」重构为「精致现代风」（Linear/Notion 质感），并补齐纯前端可实现的功能。

## 确认的方向
- **视觉**：精致现代风 — 大圆角（rounded-2xl）、柔和阴影、呼吸感留白、细腻 hover
- **动效**：克制的 transition + 点击复制反馈（缩放 + Toast + 勾选动画），其他一律克制
- **范围**：纯前端重构，mock 数据保留；不动 server

## 设计 Token（通过 main.css + app.config.ts 扩展，不改 node_modules）

### 颜色
- 保持 Nuxt UI 语义色（`primary` / `error` / `neutral`）
- 中性底色：`gray-50` / `dark:gray-950`（已有）
- 强调主色微调：在 `app.config.ts` 中把 `ui.colors.primary` 设为更现代的色相（如 `violet` 或保持默认 `indigo`，看 Nuxt UI 内置，**默认不动**，仅微调卡片背景为纯白 / dark:gray-900）

### 圆角 / 阴影
- 卡片：`rounded-2xl`（当前 `rounded-xl`）
- 阴影：`shadow-sm` → hover `shadow-lg shadow-gray-200/50 dark:shadow-black/30`（柔和、有层次）
- 顶栏 / 分组栏：毛玻璃 `backdrop-blur-xl bg-white/70 dark:bg-gray-900/70`

### 间距
- 网格 gap：`gap-3` → `gap-4`
- 页面 padding：`p-3 sm:p-4` → `p-4 sm:p-6 lg:p-8`
- 顶栏高度增加：更通透

## 文件改动清单

### 1. `app.config.ts`（新增）
- 扩展 `ui.card`、`ui.button` 的默认 slot 样式，让 UCard/UButton 默认圆角更大、阴影更柔

### 2. `app/assets/css/main.css`
- 加全局 `::selection` 色
- 平滑滚动、抗锯齿字体渲染
- 卡片 hover 上浮的统一 keyframe（用 Tailwind 类 + 少量自定义 CSS）

### 3. `app/types/meme.ts`
- 不变，仍 `Meme { id, name, src, group?, favorite?, tags? }`
- 新增 `RecentMeme extends Meme { usedAt: number }`

### 4. `app/composables/useMemes.ts`（新增）
集中管理 mock 数据 + 前端状态：
- `memes`：完整列表（mock 生成）
- `favorites`：`computed` 筛选
- `recents`：`useLocalStorage<RecentMeme[]>('ohmymeme_recents', [])`，最近使用 24 条
- `groups`：分组列表（含「全部」「收藏」「最近」三个内置组）
- `toggleFavorite(id)`：乐观更新
- `copyMeme(meme)`：调 `useClipboard` 复制图片（GIF 用 fetch → blob → ClipboardItem；SVG/PNG 直接），成功 toast + 写入 recents
- `search(keyword, group)`：筛选逻辑

> 将 `manage.vue` 里的 `buildMemes` 移到这里，让数据有唯一入口，未来接 API 时只改这里。

### 5. `app/components/AppHeader.vue` 重构
- 高度加大 `py-3`，毛玻璃
- Logo 区域加渐变图标背景块（不用多色渐变背景，用 `bg-primary/10` + `text-primary`）
- 搜索框：`size="md"`、圆角 `rounded-full`、带聚焦 ring
- 右侧加「收藏」「最近」快捷按钮（图标 + 计数角标）
- 头像 dropdown 保留

### 6. `app/components/FilterBar.vue` 重构
- 由 UTabs 改为自定义 pills（UTabs 样式受限）
- 横向滚动 pills：`全部 / 收藏(数) / 最近 / 工作 / 生活 / ...`
- 激活态：`bg-primary text-white shadow-md shadow-primary/30`
- 非激活：`bg-white dark:bg-gray-800 text-gray-600 hover:bg-gray-100`
- 圆角 `rounded-full`、间距更宽松

### 7. `app/components/MemeCard.vue` 重构
- 圆角 `rounded-2xl`、更柔阴影
- hover：`-translate-y-1 shadow-lg`、图片轻微 `scale-105`
- 角标 group：毛玻璃 + 圆角
- 底部信息条：毛玻璃更深，名称 + 操作按钮（收藏、复制）横排，按钮在 hover 时淡入
- 点击卡片本体 = 复制（主要交互），有按下的 `active:scale-95` 反馈
- 收藏按钮独立于卡片点击，stop 冒泡

### 8. `app/components/MemeGrid.vue`
- 网格列数微调：`grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7`（更密集更现代）
- gap 加大

### 9. `app/pages/manage.vue`
- 精简为容器：调 `useMemes()`，组装子组件
- 监听 copy 事件 → 触发 toast（或直接在 useMemes 里用 `useToast`）

### 10. `app/pages/index.vue`
- 入口页同步精致化：更大的 Logo 区、留白、按钮 `size="xl"`、图标在浅圆形容器中

## 复制到剪贴板实现
- 优先 `navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])`
- 失败回退：复制图片 URL 文本
- toast 反馈（用 Nuxt UI 自带 `useToast`）

## 不做的事（避免越界）
- 不动 server/，仍空
- 不接 MongoDB / S3
- 不做导入功能（需要后端）
- 不做多标签交集筛选（tags 字段保留，UI 留到下轮）
- 不加多色渐变背景（遵守 AGENTS.md）

## 验证
1. `npm run lint` 零报错
2. `npm run build` 成功
3. 手动过一遍：首页 → 进 manage → 搜索 → 切分组 → 收藏 → 复制 → 最近使用持久化

## 组件行数自检
所有组件 ≤ 150 行；超出的拆到 composable。
