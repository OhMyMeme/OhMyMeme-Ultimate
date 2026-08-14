interface RealtimePeer {
  send: (data: string) => void
}

const peers = new Set<RealtimePeer>()

export function addRealtimePeer(peer: RealtimePeer) {
  peers.add(peer)
}

export function removeRealtimePeer(peer: RealtimePeer) {
  peers.delete(peer)
}

export function getRealtimePeerCount(): number {
  return peers.size
}

export function broadcastRealtime(type: string, payload?: unknown) {
  if (!peers.size) {
    return
  }
  const message = JSON.stringify({ type, payload })
  for (const peer of peers) {
    peer.send(message)
  }
}
