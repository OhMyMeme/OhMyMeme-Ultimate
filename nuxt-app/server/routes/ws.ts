export default defineWebSocketHandler({
  async upgrade(request) {
    if (!await isWsAuthenticated(request)) {
      throw new Response('Unauthorized', { status: 401 })
    }
  },

  open(peer) {
    addRealtimePeer(peer)
  },

  close(peer) {
    removeRealtimePeer(peer)
  },

  message(peer, message) {
    if (message.text() === 'ping') {
      peer.send('pong')
    }
  }
})
