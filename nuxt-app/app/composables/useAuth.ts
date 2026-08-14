export function useAuth() {
  const token = useCookie('ohmymeme_token', {
    maxAge: 60 * 60 * 24 * 7
  })

  const isAuthenticated = computed(() => Boolean(token.value))

  function login() {
    token.value = String(Date.now())
  }

  function logout() {
    token.value = null
    navigateTo('/')
  }

  return { isAuthenticated, login, logout }
}
