export default defineEventHandler(async (event) => {
  if (!isAuthConfigured()) {
    throw createError({ statusCode: 503, statusMessage: '服务端未配置访问密钥（NUXT_ACCESS_TOKEN）' })
  }

  const body = await readBody<{ token?: string }>(event)
  const token = typeof body?.token === 'string' ? body.token : ''

  if (!verifyAccessToken(token)) {
    throw createError({ statusCode: 401, statusMessage: '访问密钥不正确' })
  }

  await setUserSession(event, {
    user: {
      name: '管理员'
    },
    loggedInAt: new Date().toISOString()
  })

  return {
    ok: true,
    token: createSessionToken()
  }
})
