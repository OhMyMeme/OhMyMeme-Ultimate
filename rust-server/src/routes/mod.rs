pub mod auth;
pub mod groups;
pub mod health;
pub mod memes;
pub mod overview;

use std::sync::Arc;

use axum::extract::State;
use axum::middleware;
use axum::response::Response;
use axum::routing::{get, patch, post};
use axum::Router;

use crate::error::AppError;
use crate::guard;
use crate::state::AppState;
use crate::ws::ws_handler;

pub fn build_router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/api/health", get(health::health))
        .route("/api/auth/login", post(auth::login))
        .route("/api/auth/status", get(auth::status))
        .route("/api/groups", get(groups::list_groups).post(groups::create_group))
        .route(
            "/api/groups/{id}",
            patch(groups::rename_group).delete(groups::delete_group),
        )
        .route(
            "/api/memes",
            get(memes::list_memes)
                .post(memes::upload_memes)
                .layer(axum::extract::DefaultBodyLimit::max(memes::MAX_REQUEST_SIZE)),
        )
        .route(
            "/api/memes/{id}",
            get(memes::get_meme)
                .patch(memes::patch_meme)
                .delete(memes::delete_meme),
        )
        .route("/api/memes/{id}/file", get(memes::meme_file))
        .route("/api/memes/{id}/thumb", get(memes::meme_thumb))
        .route("/api/memes/{id}/use", post(memes::mark_used))
        .route("/api/memes/batch", post(memes::batch_memes))
        .route("/api/tags", get(memes::list_tags))
        .route("/api/overview", get(overview::overview))
        .route("/ws", get(ws_handler))
        .fallback(not_found)
        .layer(middleware::from_fn_with_state(state.clone(), guard::guard))
        .with_state(state)
}

async fn not_found(State(_state): State<Arc<AppState>>) -> Result<Response, AppError> {
    Err(AppError::not_found("接口不存在"))
}
