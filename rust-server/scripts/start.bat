@echo off
rem OhMyMeme 服务端启动脚本（Windows）
rem 用法：双击本文件，或在命令行执行 start.bat（需已配置同目录 .env）
cd /d "%~dp0"

rem 加载同目录 .env（Windows 下从文件逐行 set）
if exist .env (
  for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
    if not "%%a"=="" if not "%%a"==" " set "%%a=%%b"
  )
)

ohmymeme-server.exe
pause
