export function useAuth() {
  const { loggedIn, fetch: fetchSession, clear } = useUserSession()

  const isAuthenticated = computed(() => loggedIn.value)

  async function login(token: string) {
    await $fetch('/api/auth/login', { method: 'POST', body: { token } })
    await fetchSession()
  }

  async function logout() {
    await clear()
    await navigateTo('/')
  }

  return { isAuthenticated, login, logout }
}
