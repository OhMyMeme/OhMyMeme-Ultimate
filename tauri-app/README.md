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

- **原生剪贴板复制**：`src/composables/useCopyMeme.ts` 拉取 `GET /api/memes/:id/file` 字节后，经自定义 Tauri 命令 `copy_file_to_clipboard`（`src-tauri/src/lib.rs`）把字节按 `mimeType` 写入临时文件，并以 `CF_HDROP`（文件拖放）写入 Windows 剪贴板（仅 Windows 生效），QQ / 微信粘贴即得图片，GIF 保留动画。非 Tauri 环境回退浏览器 `navigator.clipboard`。
- **实时同步**：`src/composables/useRealtime.ts` 连接 `ws://{server}/ws?token=<会话令牌>`，收到 `groups-changed` / `memes-changed` 即刷新数据，与 Web 端多端同步。
- **Vue 前端**：`src/pages/`（连接页、仪表盘、表情库）走 `src/composables/useApi.ts` 复用 Web API，复用 Nuxt UI 组件。

## 开发

```bash
# 需先启动 Web 服务作为后端
npm run dev            # Tauri 壳（需 Rust 环境）
npm run dev:web        # 仅 Vite 前端（端口 1420，不启动 Tauri 壳）
npm run build          # vue-tsc + vite build（仅前端产物）
npm run tauri build    # 完整打包（Rust 编译 + NSIS/MSI 安装包）
```
