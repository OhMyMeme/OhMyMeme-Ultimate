const HEARTBEAT_INTERVAL = 30 * 1000

const heartbeats = new Map<object, ReturnType<typeof setInterval>>()

export default defineWebSocketHandler({
  async upgrade(request) {
    if (!await isWsAuthenticated(request)) {
      throw new Response('Unauthorized', { status: 401 })
    }
  },

  open(peer) {
    addRealtimePeer(peer)
    try {
      peer.send(JSON.stringify({ type: 'sync', revision: getRealtimeRevision() }))
    } catch {
      // ignore send errors on freshly opened connections
    }
    const timer = setInterval(() => {
      try {
        peer.send('ping')
      } catch {
        // ignore send errors on stale connections
      }
    }, HEARTBEAT_INTERVAL)
    heartbeats.set(peer, timer)
  },

  close(peer) {
    removeRealtimePeer(peer)
    const timer = heartbeats.get(peer)
    if (timer) {
      clearInterval(timer)
      heartbeats.delete(peer)
    }
  },

  message(peer, message) {
    if (message.text() === 'ping') {
      peer.send('pong')
    }
  }
})
