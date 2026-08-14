export default defineEventHandler(async (event) => {
  return {
    configured: isAuthConfigured(),
    authenticated: await isAuthenticated(event)
  }
})
