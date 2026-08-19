OhMyMeme 服务端部署说明（Rust 后端）
=====================================

前置要求
--------
1. MongoDB（本地安装，或使用 MongoDB Atlas 免费云数据库）
2. 本包内已含 Linux x64 的 ohmymeme-server 二进制（由发布流程编译）。
   Windows 服务端需自行编译 rust-server（见 DEVELOPER.md）。

快速开始
--------
1. 将 .env.example 复制一份并重命名为 .env
2. 用文本编辑器打开 .env，配置以下必填项：
   - MONGO_URI      MongoDB 连接串（默认 mongodb://localhost:27017/ohmymeme）
   - ACCESS_TOKEN   登录访问密钥（客户端连接页输入该字符串；必填）
3. 启动：
   - Windows：双击 start.bat
   - Linux / macOS：终端执行 ./start.sh
     （或直接执行 ./ohmymeme-server）
4. 桌面端在连接页填入服务地址（默认 http://localhost:3000），输入访问密钥登录

生成访问密钥示例
----------------
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

可选配置（.env 内）
------------------
- PORT                监听端口，默认 3000
- HOST                监听地址，默认 0.0.0.0（局域网可访问）
- ALLOWED_ORIGINS     跨域白名单（逗号分隔），默认同源 + 桌面端
- STORAGE_LOCAL_DIR   表情文件存储目录，默认 .data/uploads/memes
- WEB_ENABLED         是否开放 Web 页面，默认 false（仅 API / WebSocket，桌面端使用）
- RUST_LOG            日志级别：error / warn / info / debug

注意事项
--------
- 上传的表情文件保存在程序目录下的 .data/uploads/memes
- 除登录接口外，所有 API 与文件接口均需鉴权；桌面端使用登录时返回的短期会话令牌（7 天过期）
- 多端实时同步经 WebSocket（/ws）推送，登录后自动生效
- 若部署到公网，建议将服务置于 HTTPS 反向代理之后
