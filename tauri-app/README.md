# ohmymeme-desktop

OhMyMeme-Ultimate 的桌面端（Tauri 2 + Vue 3 + Vite）workspace。

桌面端只承担壳层能力，**复用 Web 端（`nuxt-app/`）的后端 API**，通过 HTTP 与 Nitro 服务端通信：

- 服务端地址由用户在首次启动的连接页（`/connect`）自行输入，存于 `useStorage("ohmymeme_server_url")`（无默认值，未配置时强制进入连接页）。
- 本地调试填 `http://localhost:3000`；Web 常部署在云端时填云端地址。

## 鉴权

连接页同时要求输入访问密钥（`NUXT_ACCESS_TOKEN`）。`src/composables/useAuth.ts` 调用 `POST /api/auth/login` 换取**短期会话令牌**（HMAC 签名、7 天过期）并存于 `useStorage("ohmymeme_session_token")`：

- `useApi`（`src/composables/useApi.ts`）对每个请求附加 `Authorization: Bearer <会话令牌>`。
- 表情图片 URL 与 WebSocket 连接通过 `authorizeUrl()` 追加 `?token=<会话令牌>`。
- 未登录（无令牌）时强制进入 `/connect` 连接页；退出登录即清除令牌。

## 关键能力

- **自建标题栏**：`tauri.conf.json` 设置 `decorations: false` 移除系统标题栏，`src/components/TitleBar.vue` 提供最小化 / 最大化（还原态图标自动切换）/ 关闭三大键，整条栏可拖动（`data-tauri-drag-region="deep"`，双击最大化）。窗口能力权限在 `src-tauri/capabilities/default.json`（`start-dragging` / `minimize` / `maximize` / `unmaximize` / `toggle-maximize` / `close`）。
- **系统托盘 + 全局快捷键**：`src-tauri/src/lib.rs` 创建托盘（左键 / 全局快捷键（默认 `Ctrl+Alt+N`，设置中心可自定义）切换窗口显隐，右键菜单「显示 / 退出」）；**标题栏 ✕ 为隐藏到托盘**，托盘菜单「退出」才真正退出。修改 `Cargo.toml` / `capabilities` / `tauri.conf.json` 后需等 `tauri dev` 重编译生效。
- **原生剪贴板复制**：`src/composables/useCopyMeme.ts` 拉取 `GET /api/memes/:id/file` 字节后，经自定义 Tauri 命令 `copy_file_to_clipboard`（`src-tauri/src/lib.rs`）把字节按 `mimeType` 写入临时文件，并以 `CF_HDROP`（文件拖放）写入 Windows 剪贴板（仅 Windows 生效），QQ / 微信粘贴即得图片，GIF 保留动画。非 Tauri 环境回退浏览器 `navigator.clipboard`。「复制成功提示」「PNG 回退」可在设置中开关（`useSettings`）。
- **设置中心**（`/settings`）：服务器地址（修改后需重新登录）、连接状态心跳卡（在线 / 离线 / 延迟 / 手动检测）、外观（浅色 / 深色 / 跟随系统）、界面缩放（自动随窗口宽度，或手动 100% / 115% / 130%）、复制行为开关、退出登录 / 清除本地数据、关于（版本号）。
- **动态心跳检测**：`src/composables/useHeartbeat.ts` 全局启动，在线每 15s、离线每 3s 探测 `GET /api/health`，侧边栏「设置」按钮实时状态圆点；**服务器断连自动跳转专属页 `/disconnected`**（显示服务器地址 / 最近在线时间 / 重试按钮 / 服务器设置入口），恢复后自动返回。
- **实时同步**：`src/composables/useRealtime.ts` 连接 `ws://{server}/ws?token=<会话令牌>`，广播携带 `revision`，收到 `groups-changed` / `memes-changed` 即刷新数据；新连接 / 断线重连后收到 `sync` 消息，revision 落后即全量补差，与 Web 端多端同步。
- **上传**：`src/composables/useUpload.ts` 走 XHR（字节级进度条），客户端预校验（格式 / 大小 / 空文件，单次上限 500 个），服务端逐文件校验返回 `{ results }`，失败项在弹窗中显示原因并支持**一键重试**，按 20 个 / 100MB 分批限速顺序上传。
- **表情网格**：无限滚动（`useIntersectionObserver` 底部哨兵自动加载），列数随窗口自适应（3~12 列）；GIF 卡片直接显示原图（保留动画），其他格式走 WebP 缩略图。

## 开发

```bash
# 需先启动 Web 服务作为后端
npm run dev            # Tauri 壳（需 Rust 环境）
npm run dev:web        # 仅 Vite 前端（端口 1420，不启动 Tauri 壳）
npm run build          # vue-tsc + vite build（仅前端产物）
npm run tauri build    # 完整打包（Rust 编译 + NSIS/MSI 安装包）
```

> 注意：修改 `src-tauri/`（Cargo.toml / capabilities / tauri.conf.json / lib.rs）后需等待 `tauri dev` 自动重编译（新增 Rust 依赖时首次编译较久）。
