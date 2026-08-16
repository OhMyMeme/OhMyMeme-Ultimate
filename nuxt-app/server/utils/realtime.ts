interface RealtimePeer {
  send: (data: string) => void
}

const peers = new Set<RealtimePeer>()

let revision = 0

export function getRealtimeRevision(): number {
  return revision
}

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
  revision++
  if (!peers.size) {
    return
  }
  const message = JSON.stringify({ type, revision, payload })
  for (const peer of peers) {
    try {
      peer.send(message)
    } catch {
      removeRealtimePeer(peer)
    }
  }
}
