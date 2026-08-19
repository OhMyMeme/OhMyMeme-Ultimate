use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use tokio::sync::mpsc;

#[derive(Default)]
pub struct Realtime {
    revision: AtomicU64,
    peers: Mutex<Vec<mpsc::UnboundedSender<String>>>,
}

impl Realtime {
    pub fn revision(&self) -> u64 {
        self.revision.load(Ordering::SeqCst)
    }

    pub fn add_peer(&self, tx: mpsc::UnboundedSender<String>) {
        self.peers.lock().unwrap().push(tx);
    }

    pub fn remove_peer(&self, tx: &mpsc::UnboundedSender<String>) {
        self.peers.lock().unwrap().retain(|p| !p.same_channel(tx));
    }

    #[allow(dead_code)]
    pub fn peer_count(&self) -> usize {
        self.peers.lock().unwrap().len()
    }

    pub fn broadcast(&self, type_: &str, payload: Option<serde_json::Value>) {
        let revision = self.revision.fetch_add(1, Ordering::SeqCst) + 1;
        log_debug!("实时广播: {type_} revision={revision} 连接数={}", self.peer_count());
        let message = match payload {
            Some(payload) => serde_json::json!({
                "type": type_,
                "revision": revision,
                "payload": payload
            }),
            None => serde_json::json!({
                "type": type_,
                "revision": revision
            }),
        };
        let text = message.to_string();
        let mut peers = self.peers.lock().unwrap();
        peers.retain(|tx| tx.send(text.clone()).is_ok());
    }
}
