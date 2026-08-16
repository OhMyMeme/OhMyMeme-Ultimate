export default defineEventHandler((event) => {
  if (useRuntimeConfig().webEnabled) {
    return
  }

  const path = event.path

  if (
    path === '/ws'
    || path.startsWith('/api/')
    || path.startsWith('/_nuxt/')
    || path.startsWith('/_ipx/')
  ) {
    return
  }

  setResponseStatus(event, 403)
  setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Web 访问已禁止</title>
</head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b0f14;color:#e2e8f0;font-family:ui-sans-serif,system-ui,sans-serif">
<main style="text-align:center;padding:24px">
<h1 style="font-size:28px;font-weight:600;margin:0 0 12px">Web 访问已禁止</h1>
<p style="color:#94a3b8;margin:0 0 8px">当前服务仅供 OhMyMeme 桌面端使用。</p>
<p style="color:#64748b;font-size:14px;margin:0">如需开放 Web 端，请设置环境变量 NUXT_WEB_ENABLED=true 后重启服务。</p>
</main>
</body>
</html>`
})
