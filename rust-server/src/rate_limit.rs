use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

struct Entry {
    count: u32,
    reset_at: Instant,
}

#[derive(Default)]
pub struct RateLimiter {
    buckets: Mutex<HashMap<String, Entry>>,
}

impl RateLimiter {
    pub fn check(&self, key: &str, limit: u32, window: Duration) -> bool {
        let mut buckets = self.buckets.lock().unwrap();
        let now = Instant::now();

        if buckets.len() >= 1000 {
            buckets.retain(|_, e| e.reset_at > now);
        }

        match buckets.get_mut(key) {
            Some(entry) if entry.reset_at > now => {
                if entry.count >= limit {
                    false
                } else {
                    entry.count += 1;
                    true
                }
            }
            _ => {
                buckets.insert(
                    key.to_string(),
                    Entry {
                        count: 1,
                        reset_at: now + window,
                    },
                );
                true
            }
        }
    }
}
