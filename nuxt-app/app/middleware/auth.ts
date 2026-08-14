export default defineNuxtRouteMiddleware(async () => {
  const { loggedIn, fetch } = useUserSession()

  if (import.meta.client && loggedIn.value) {
    await fetch()
  }

  if (!loggedIn.value) {
    return navigateTo('/')
  }
})
