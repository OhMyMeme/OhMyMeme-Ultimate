export default defineEventHandler(async (event) => {
  const path = event.path

  if (!path.startsWith('/api/')) {
    return
  }

  if (event.method === 'OPTIONS') {
    setResponseStatus(event, 204)
    return null
  }

  if (path.startsWith('/api/_auth/') || path.startsWith('/api/auth/')) {
    return
  }

  if (await isAuthenticated(event)) {
    return
  }

  throw createError({ statusCode: 401, statusMessage: '未登录或登录已过期' })
})
