export function useRealtime() {
  const { loggedIn } = useUserSession()

  const { status, data, open, close } = useWebSocket('/ws', {
    immediate: false,
    autoReconnect: { retries: 3, delay: 2000 },
    onMessage: (_ws, event) => {
      try {
        const message = JSON.parse(event.data)
        if (message?.type === 'groups-changed') {
          refreshNuxtData('meme-groups')
        } else if (message?.type === 'memes-changed') {
          refreshNuxtData()
        }
      } catch {
        // ignore non-JSON messages (e.g. pong)
      }
    }
  })

  watch(loggedIn, (isLoggedIn) => {
    if (isLoggedIn) {
      open()
    } else {
      close()
    }
  }, { immediate: true })

  return { status, data }
}
