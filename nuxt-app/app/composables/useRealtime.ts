export function useRealtime() {
  const { loggedIn } = useUserSession()

  const lastRevision = ref(0)

  const { status, data, open, close } = useWebSocket('/ws', {
    immediate: false,
    autoReconnect: { retries: Infinity, delay: 2000 },
    onMessage: (_ws, event) => {
      try {
        const message = JSON.parse(event.data)
        const revision = typeof message?.revision === 'number' ? message.revision : 0
        if (message?.type === 'sync') {
          if (lastRevision.value > 0 && revision > lastRevision.value) {
            refreshNuxtData()
          }
          lastRevision.value = Math.max(lastRevision.value, revision)
        } else if (message?.type === 'groups-changed') {
          lastRevision.value = Math.max(lastRevision.value, revision)
          refreshNuxtData('meme-groups')
        } else if (message?.type === 'memes-changed') {
          lastRevision.value = Math.max(lastRevision.value, revision)
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
