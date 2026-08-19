use std::sync::Arc;

use axum::extract::State;
use axum::response::Response;

use crate::guard::json_response;
use crate::state::AppState;

pub async fn health(State(state): State<Arc<AppState>>) -> Response {
    let uptime = state.started_at.elapsed().as_secs();
    json_response(serde_json::json!({
        "ok": true,
        "uptime": uptime,
    }))
}
