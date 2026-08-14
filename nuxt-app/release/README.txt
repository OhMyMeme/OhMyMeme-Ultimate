OhMyMeme-Ultimate 部署说明
==========================

前置要求
--------
1. Node.js >= 20（https://nodejs.org，安装时勾选 npm 即可）
2. MongoDB（本地安装，或使用 MongoDB Atlas 免费云数据库）

快速开始
--------
1. 将 .env.example 复制一份并重命名为 .env
2. 用文本编辑器打开 .env，配置以下必填项：
   - NUXT_MONGOOSE_URI      MongoDB 连接串
   - NUXT_ACCESS_TOKEN      登录访问密钥（登录页输入该字符串）
   - NUXT_SESSION_PASSWORD  会话签名密钥（至少 32 字符）
3. 启动：
   - Windows：双击 start.bat
   - Linux / macOS：终端执行 ./start.sh
   （也可在命令行执行：node start.mjs）
4. 浏览器访问 http://localhost:3000，输入访问密钥登录

生成密钥示例
------------
- 访问密钥：node -e "console.log(require('crypto').randomBytes(128).toString('hex'))"
- 会话密钥：node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

可选配置（.env 内）
-------------------
- PORT              监听端口，默认 3000
- HOST              监听地址，默认 0.0.0.0（局域网可访问）

注意事项
--------
- 上传的表情文件保存在程序目录下的 .data/uploads/memes
- 除登录接口外，所有 API 与文件接口均需鉴权；登录状态经密封 Cookie 会话持久化，
  桌面端客户端使用登录时返回的短期会话令牌（7 天过期）
- 多端实时同步经 WebSocket（/ws）推送，登录后自动生效
