# ohmymeme-server (Rust 后端)

OhMyMeme-Ultimate 的独立 Rust 后端，完全替代原 `nuxt-app/server`（Nitro/TypeScript）实现。
**API 契约与 WS 实时同步行为与原实现完全对齐**——桌面端（`tauri-app`）与 Web 前端只需把连接地址指向本服务，零改动即可工作。

## 技术栈

- **axum 0.8**（HTTP + WebSocket，Tokio）
- **mongodb 3.8**（官方驱动，action builder API）
- **image**（PNG/JPEG/GIF/WebP 解码 + WebP 编码，缩略图生成）
- **hmac/sha2**（会话令牌签名）、**uuid**（存储键）

## 模块结构

```
src/
  main.rs        # 入口：配置加载 → MongoDB 连接 → 索引 → 路由 → 监听
  config.rs      # 环境变量（MONGO_URI / ACCESS_TOKEN / PORT / HOST / ALLOWED_ORIGINS / STORAGE_LOCAL_DIR / WEB_ENABLED）
  error.rs       # AppError → JSON {statusCode, message}（与 h3 createError 格式一致）
  state.rs       # AppState（MongoDB / 存储 / 实时广播 / 限流）+ 系统分组逻辑 + 索引
  auth.rs        # 访问密钥校验、会话令牌签发/校验（HMAC-SHA256）、Cookie 自洽会话
  guard.rs       # 中间件：CORS 白名单 / OPTIONS 204 / web-disabled 403 / 限流 / 鉴权
  storage.rs     # 本地文件存储 + 魔数嗅探（PNG/GIF/JPEG/WebP）+ 256px WebP 缩略图
  realtime.rs    # WS 广播（自增 revision）+ 连接池
  ws.rs          # /ws 处理器（升级鉴权、sync 下发、30s 心跳、ping/pong）
  models.rs      # Group/Meme BSON 文档（camelCase 字段映射）+ DTO
  routes/        # API 路由（auth / groups / memes / overview / health）
```

## 环境变量（`.env.example`）

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `MONGO_URI` | `mongodb://localhost:27017/ohmymeme` | MongoDB 连接串（库名取自 URI） |
| `ACCESS_TOKEN` | 空 | 登录访问密钥（必填，与服务端 API 契约一致） |
| `PORT` / `HOST` | `3000` / `0.0.0.0` | 监听端口/地址 |
| `ALLOWED_ORIGINS` | 桌面端来源 | CORS 白名单（逗号分隔，追加到默认列表） |
| `STORAGE_LOCAL_DIR` | `.data/uploads/memes` | 表情文件存储目录 |
| `WEB_ENABLED` | `false` | `false` 时非 `/api`、`/ws` 的页面请求返回 403 提示页 |
| `RUST_LOG` | `info` | 日志级别：`error` / `warn` / `info` / `debug`（`debug` 输出鉴权失败原因、实时广播等细节） |

## 日志

所有日志输出到 **stderr**，格式 `[UTC 时间] [级别] 消息`。默认 `info` 级别包含：

- 启动摘要（监听地址、存储目录、鉴权/Web 开关、CORS 来源数、MongoDB 连接）
- **每个 HTTP 请求一行**：`方法 路径 -> 状态码 (耗时ms) 来源IP`（5xx 记 ERROR、4xx 记 WARN）
- 登录成功/失败（含 IP）、登录限流触发
- 上传逐文件结果（成功/失败原因）、分组/表情增删改、批量操作
- WS 连接建立/断开（含剩余连接数）

`warn` 级别额外包含：接口限流触发、鉴权失败等；`debug` 级别额外包含：鉴权失败原因、实时广播（类型/revision/连接数）、记录最近使用等细节。

## 构建与运行

```bash
cd rust-server
cargo build --release
ACCESS_TOKEN=<你的访问密钥> cargo run --release
```

> **本机离线构建**：若系统 schannel TLS 不可用（`curl: schannel SEC_E_NO_CREDENTIALS`），cargo 无法直连 crates.io。
> 已配置 `rust-server/.cargo/config.toml` 指向本地 vendored 依赖（`vendor/` 目录，约 282 个 crate）。
> 依赖变更后重新 vendor 的流程：
> ```bash
> node scripts/sparse-mirror.js 7898   # 后台：本地 sparse index 镜像（Node 走 openssl）
> cargo generate-lockfile              # 通过镜像解析依赖
> node scripts/vendor-download.js      # 从 static.crates.io 下载并解压到 vendor/
> cargo build --offline
> ```

## 桌面端自动更新

桌面端（`tauri-app`）已接入 **tauri-plugin-updater v2** 自动更新。**更新清单（`latest.json`）与安装包均由 GitHub Release 托管**，桌面端 `tauri.conf.json` 的 `plugins.updater.endpoints` 直连：

```
https://github.com/<owner>/<repo>/releases/latest/download/latest.json
```

更新分发**不依赖 rust-server 新增任何端点**——本服务仅提供业务 API，不参与更新托管。

### 发布流程要点

- **minisign 签名**：发布前用 `npx tauri signer generate -w` 生成签名密钥对（公钥填入 `plugins.updater.pubkey`）；CI 以 secrets（`TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`）对安装包执行 `tauri signer sign`，产出 `.sig` 签名。
- **`latest.json` 结构**（由 `tauri-app/scripts/make-update-manifest.mjs` 生成）：

| 字段 | 要求 |
| --- | --- |
| `version` | 与 `tauri.conf.json` 的 `version` 一致，**不带 `v` 前缀** |
| `pub_date` | RFC3339 格式（如 `2025-01-01T00:00:00Z`） |
| `platforms.windows-x86_64.signature` | minisign 签名的 **base64** 内容 |
| `platforms.windows-x86_64.url` | 安装包的**绝对 HTTPS** 下载地址 |

- **版本必须严格递增**：updater 仅当清单 `version` 高于当前应用版本时才提示更新，低于或等于当前版本会被忽略。

> 如需**自托管更新**（绕过 GitHub Release），后续可在 rust-server 增加 `/update/` 静态端点托管 `latest.json` 与安装包（本次未实现）。

## 测试

启动服务后（独立测试库，避免污染数据）：

```bash
# API 冒烟测试（登录/分组/表情/文件/聚合/CORS/限流，23 项）
# 注意：脚本假设测试库为空，需先 drop 或换新库
node -e "require('mongoose').connect('mongodb://localhost:27017/ohmymeme_rust_test').then(()=>require('mongoose').connection.dropDatabase())"
MONGO_URI=mongodb://localhost:27017/ohmymeme_rust_test PORT=3100 ACCESS_TOKEN=<token> cargo run
# 另开终端（rust-server 目录）：
# pwsh scripts/smoke-test.ps1     （PS 5.1 下中文比较为客户端编码误报，服务端已用 curl 验证）
# node scripts/edge-test.js       （聚合 covers/count、坏文件拒绝、未分组落位）
# node scripts/ws-test.js         （WS sync/ping-pong/广播 revision）
```

## 与原 Nitro 实现的契约对照

| 端点 | 行为 |
| --- | --- |
| `GET /api/health` | `{ok, uptime}`，公开 |
| `POST /api/auth/login` | 校验访问密钥（限流 5 次/分/IP），返回 `{ok, token}` + `Set-Cookie`；错误 401/429/503 |
| `GET /api/auth/status` | `{configured, authenticated}`，公开 |
| `GET /api/groups` | 数组；排序 收藏→最近使用→未分组→自定义；每项含 `count` + `covers`（最新 4 张缩略图 URL） |
| `POST/PATCH/DELETE /api/groups[/:id]` | 创建/改名/删除；409 重名/系统保留名、403 系统分组、409 非空删除 |
| `GET /api/memes` | `{items, total, limit, offset}`；分页/排序/过滤；最近使用上限 50；未分组与自定义分组按 `sortOrder` 降序（自定义拖动顺序）再回落 `createdAt` 降序 |
| `POST /api/memes` | multipart 多文件上传（≤20 个、单文件 ≤20MB、最长边 ≤2560px、总请求 ≤100MB）；逐文件校验，坏文件不阻断整批；返回 `{results}` |
| `GET/PATCH/DELETE /api/memes/:id` | 单条/改名移动收藏/删除（含清理文件） |
| `GET /api/memes/:id/file` | 原图，支持 `Range`（206/416），`cache-control: private, immutable` |
| `GET /api/memes/:id/thumb` | 缩略图（无缩略图回退原图） |
| `POST /api/memes/:id/use` | 记录最近使用（`usedAt`）并广播 |
| `POST /api/memes/batch` | `{ids, action: move|delete, groupId?}` → `{moved}` / `{deleted}` |
| `POST /api/memes/reorder` | 拖动排序：`{id, beforeId?}` 把 `id` 移到 `beforeId` 之前（`beforeId` 省略/为 null 则移到末尾）→ `{ok}`；仅未分组与自定义分组可排序，收藏/最近使用返回 400 |
| `GET /api/overview` | `{memeCount, favoriteCount, groupCount, storageBytes}`，5s TTL 缓存 |
| `WS /ws` | 升级鉴权（Bearer/`?token=`/Cookie）；连接即发 `{type:"sync",revision}`；30s 文本 `ping`；文本 `ping`→`pong`；变更广播 `{type, revision, payload}` |

鉴权：受保护 `/api/**`（除 `auth`/`_auth`/`health`）接受 `Authorization: Bearer <会话令牌>`、`?token=`、`nuxt-session` Cookie 三者之一，否则 401。

## 已知差异（有意为之，契约仍兼容）

1. **Cookie 会话**：原 `nuxt-auth-utils` 使用 iron-seal（`Fe26.2*` + AES-256-CBC + PBKDF2）加密 Cookie；本实现为自洽简化版（Cookie 值即会话令牌）。桌面端走 Bearer 令牌不受影响；Web 前端（暂缓开发）若启用需同步调整或补齐 iron-seal。
2. **缩略图编码**：`image` crate 仅支持 WebP **lossless** 编码（原 sharp 为 quality 80 lossy）。输出仍为 256px WebP，尺寸略大，格式契约不变。
3. **环境变量命名**：原 `NUXT_*` 前缀改为 `MONGO_URI` / `ACCESS_TOKEN` / `ALLOWED_ORIGINS` / `STORAGE_LOCAL_DIR` / `WEB_ENABLED`。
4. **web-disabled 页面**：Rust 服务不托管静态资源，`WEB_ENABLED=false` 时非 API/WS 路径返回与原文一致的 403 提示页。
5. **自定义拖动排序（新增）**：`Meme` 增加可选 `sortOrder`（数值越大越靠前）。历史数据无该字段，降序排序下自动排在已手工排序的表情之后，无需迁移脚本。收藏（跨分组视图）与最近使用（按 `usedAt`）保持原有固定排序语义；换组（`PATCH` / `batch move`）会清除旧的 `sortOrder`。
