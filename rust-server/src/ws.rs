use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Query, State};
use axum::response::Response;
use futures_util::{SinkExt, StreamExt};
use tokio::sync::mpsc;

use crate::auth::{resolve_session_token, verify_session_token};
use crate::error::AppError;
use crate::state::AppState;

const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(30);

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Response, AppError> {
    let token = resolve_session_token(&headers, params.get("token").map(|s| s.as_str()));
    let authenticated = token
        .as_deref()
        .map(|t| verify_session_token(&state.config.access_token, t))
        .unwrap_or(false);
    if !authenticated {
        log_warn!("WS 连接被拒: 鉴权失败，来自 {}", ip_or_unknown(&headers));
        return Err(AppError::unauthorized("未登录或登录已过期"));
    }

    log_info!("WS 连接建立: 来自 {}", ip_or_unknown(&headers));
    Ok(ws.on_upgrade(move |socket| handle_socket(socket, state)))
}

fn ip_or_unknown(headers: &axum::http::HeaderMap) -> String {
    headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.split(',').next())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "unknown".to_string())
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
    let (mut tx, mut rx) = socket.split();
    let (send_tx, mut send_rx) = mpsc::unbounded_channel::<String>();
    state.realtime.add_peer(send_tx.clone());

    let sync = serde_json::json!({ "type": "sync", "revision": state.realtime.revision() }).to_string();
    if tx.send(Message::Text(sync.into())).await.is_err() {
        state.realtime.remove_peer(&send_tx);
        return;
    }

    let hb_tx = send_tx.clone();
    let hb_task = tokio::spawn(async move {
        let mut interval = tokio::time::interval(HEARTBEAT_INTERVAL);
        interval.tick().await; // consume the immediate first tick
        loop {
            interval.tick().await;
            if hb_tx.send("ping".to_string()).is_err() {
                break;
            }
        }
    });

    loop {
        tokio::select! {
            incoming = rx.next() => {
                match incoming {
                    Some(Ok(Message::Text(text))) if text.as_str() == "ping" => {
                        if tx.send(Message::Text("pong".into())).await.is_err() {
                            break;
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => break,
                    _ => {}
                }
            }
            outgoing = send_rx.recv() => {
                match outgoing {
                    Some(text) => {
                        if tx.send(Message::Text(text.into())).await.is_err() {
                            break;
                        }
                    }
                    None => break,
                }
            }
        }
    }

    hb_task.abort();
    state.realtime.remove_peer(&send_tx);
    log_info!("WS 连接断开: 剩余连接数={}", state.realtime.peer_count());
}
