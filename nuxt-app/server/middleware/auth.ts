export default defineEventHandler(async (event) => {
  const path = event.path

  if (!path.startsWith('/api/')) {
    return
  }

  applyCors(event)

  if (event.method === 'OPTIONS') {
    setResponseStatus(event, 204)
    return null
  }

  if (path.startsWith('/api/_auth/') || path.startsWith('/api/auth/') || path === '/api/health') {
    return
  }

  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  if (!checkRateLimit(`api:${ip}`, 600, 60 * 1000)) {
    throw createError({ statusCode: 429, message: '请求过于频繁，请稍后再试' })
  }

  if (await isAuthenticated(event)) {
    return
  }

  throw createError({ statusCode: 401, message: '未登录或登录已过期' })
})
