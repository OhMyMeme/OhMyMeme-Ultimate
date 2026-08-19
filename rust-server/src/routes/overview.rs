use std::sync::Arc;
use std::time::Duration;

use axum::extract::State;
use axum::response::Response;
use futures_util::TryStreamExt;
use mongodb::bson::doc;

use crate::error::AppError;
use crate::guard::json_response;
use crate::state::{AppState, Overview};

const OVERVIEW_TTL: Duration = Duration::from_secs(5);

pub async fn overview(State(state): State<Arc<AppState>>) -> Result<Response, AppError> {
    if let Some((fetched_at, cached)) = &*state.overview_cache.lock().unwrap() {
        if fetched_at.elapsed() < OVERVIEW_TTL {
            return Ok(json_response(cached.to_json()));
        }
    }

    let meme_count = state.memes().count_documents(doc! {}).await? as i64;
    let favorite_count = state
        .memes()
        .count_documents(doc! { "favorite": true })
        .await? as i64;
    let group_count = state
        .groups()
        .count_documents(doc! {
            "isFavorites": { "$ne": true },
            "isRecent": { "$ne": true },
            "isUngrouped": { "$ne": true },
        })
        .await? as i64;

    let storage: Vec<mongodb::bson::Document> = state
        .memes()
        .aggregate(vec![doc! {
            "$group": {
                "_id": null,
                "total": { "$sum": "$size" }
            }
        }])
        .await?
        .try_collect()
        .await?;
    let storage_bytes = storage
        .first()
        .and_then(|d| d.get_i64("total").ok())
        .unwrap_or(0);

    let value = Overview {
        meme_count,
        favorite_count,
        group_count,
        storage_bytes,
    };

    *state.overview_cache.lock().unwrap() = Some((std::time::Instant::now(), value.clone()));

    Ok(json_response(value.to_json()))
}
