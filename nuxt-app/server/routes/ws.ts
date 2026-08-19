const HEARTBEAT_INTERVAL = 30 * 1000

interface RealtimePeer {
  send: (data: string) => unknown
}

const heartbeats = new Map<RealtimePeer, ReturnType<typeof setInterval>>()

function removePeer(peer: RealtimePeer) {
  removeRealtimePeer(peer)
  const timer = heartbeats.get(peer)
  if (timer) {
    clearInterval(timer)
    heartbeats.delete(peer)
  }
}

function sendToPeer(peer: RealtimePeer, message: string) {
  try {
    Promise.resolve(peer.send(message)).catch(() => removePeer(peer))
  } catch {
    removePeer(peer)
  }
}

export default defineWebSocketHandler({
  async upgrade(request) {
    if (!await isWsAuthenticated(request)) {
      throw new Response('Unauthorized', { status: 401 })
    }
  },

  open(peer) {
    addRealtimePeer(peer)
    sendToPeer(peer, JSON.stringify({ type: 'sync', revision: getRealtimeRevision() }))
    const timer = setInterval(() => {
      sendToPeer(peer, 'ping')
    }, HEARTBEAT_INTERVAL)
    heartbeats.set(peer, timer)
  },

  close(peer) {
    removePeer(peer)
  },

  error(peer) {
    removePeer(peer)
  },

  message(peer, message) {
    if (message.text() === 'ping') {
      sendToPeer(peer, 'pong')
    }
  }
})
