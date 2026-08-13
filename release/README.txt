OhMyMeme-Ultimate 部署说明
==========================

前置要求
--------
1. Node.js >= 20（https://nodejs.org，安装时勾选 npm 即可）
2. MongoDB（本地安装，或使用 MongoDB Atlas 免费云数据库）

快速开始
--------
1. 将 .env.example 复制一份并重命名为 .env
2. 用文本编辑器打开 .env，把 NUXT_MONGOOSE_URI 改成你的 MongoDB 连接串
3. 启动：
   - Windows：双击 start.bat
   - Linux / macOS：终端执行 ./start.sh
   （也可在命令行执行：node start.mjs）
4. 浏览器访问 http://localhost:3000

可选配置（.env 内）
------------------
- NUXT_MONGOOSE_URI  MongoDB 连接串（必填）
- PORT              监听端口，默认 3000
- HOST              监听地址，默认 0.0.0.0（局域网可访问）

注意事项
--------
- 上传的表情文件保存在程序目录下的 .data/uploads/memes
- 本版本鉴权尚未实现，仅建议在本地 / 内网使用
