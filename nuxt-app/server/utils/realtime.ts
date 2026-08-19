interface RealtimePeer {
  send: (data: string) => unknown
}

const peers = new Set<RealtimePeer>()

let revision = 0

function sendToPeer(peer: RealtimePeer, message: string, onError: () => void) {
  try {
    Promise.resolve(peer.send(message)).catch(onError)
  } catch {
    onError()
  }
}

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
    sendToPeer(peer, message, () => removeRealtimePeer(peer))
  }
}
