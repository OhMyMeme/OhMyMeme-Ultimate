use std::sync::Arc;
use std::sync::Mutex;

use mongodb::bson::{doc, oid::ObjectId};
use mongodb::{Collection, Database};

use crate::config::Config;
use crate::error::AppError;
use crate::models::{
    ensure_system_group_doc, group_filter_doc, GroupDoc, MemeDoc, SYSTEM_GROUP_NAMES,
};
use crate::rate_limit::RateLimiter;
use crate::realtime::Realtime;
use crate::storage::Storage;

pub struct AppState {
    pub config: Config,
    pub db: Database,
    pub storage: Storage,
    pub realtime: Arc<Realtime>,
    pub rate_limiter: Arc<RateLimiter>,
    pub started_at: std::time::Instant,
    pub overview_cache: Mutex<Option<(std::time::Instant, Overview)>>,
}

#[derive(Debug, Clone)]
pub struct Overview {
    pub meme_count: i64,
    pub favorite_count: i64,
    pub group_count: i64,
    pub storage_bytes: i64,
}

impl Overview {
    pub fn to_json(&self) -> serde_json::Value {
        serde_json::json!({
            "memeCount": self.meme_count,
            "favoriteCount": self.favorite_count,
            "groupCount": self.group_count,
            "storageBytes": self.storage_bytes,
        })
    }
}

impl AppState {
    pub fn groups(&self) -> Collection<GroupDoc> {
        self.db.collection::<GroupDoc>("groups")
    }

    pub fn memes(&self) -> Collection<MemeDoc> {
        self.db.collection::<MemeDoc>("memes")
    }

    pub async fn ensure_system_groups(&self) -> Result<(), AppError> {
        let system = [
            ("isFavorites", "收藏"),
            ("isRecent", "最近使用"),
            ("isUngrouped", "未分组"),
        ];
        for (flag, name) in system {
            let exists = self
                .groups()
                .find_one(group_filter_doc(flag))
                .await?
                .is_some();
            if exists {
                continue;
            }
            // upsert with $setOnInsert; concurrent requests are idempotent
            self.groups()
                .update_one(group_filter_doc(flag), ensure_system_group_doc(name, flag))
                .upsert(true)
                .await?;
        }
        Ok(())
    }

    pub async fn get_ungrouped_group(&self) -> Result<Option<GroupDoc>, AppError> {
        self.ensure_system_groups().await?;
        Ok(self
            .groups()
            .find_one(group_filter_doc("isUngrouped"))
            .await?)
    }

    pub async fn ensure_indexes(&self) -> Result<(), AppError> {
        self.memes()
            .create_index(
                mongodb::IndexModel::builder()
                    .keys(doc! { "groupId": 1, "sortOrder": -1, "createdAt": -1 })
                    .build(),
            )
            .await?;
        self.memes()
            .create_index(
                mongodb::IndexModel::builder()
                    .keys(doc! { "favorite": 1, "createdAt": -1 })
                    .build(),
            )
            .await?;
        self.memes()
            .create_index(
                mongodb::IndexModel::builder()
                    .keys(doc! { "usedAt": -1 })
                    .build(),
            )
            .await?;
        Ok(())
    }
}

/// Reject system-reserved names for user-created groups (409).
pub fn check_system_name(name: &str) -> Result<(), AppError> {
    if SYSTEM_GROUP_NAMES.contains(&name) {
        return Err(AppError::conflict("该分组名为系统保留名"));
    }
    Ok(())
}

pub fn require_object_id(value: &str) -> Result<ObjectId, AppError> {
    ObjectId::parse_str(value).map_err(|_| AppError::bad_request("无效的 ID"))
}

pub async fn find_group_or_404(state: &AppState, id: &ObjectId) -> Result<GroupDoc, AppError> {
    state
        .groups()
        .find_one(doc! { "_id": id })
        .await?
        .ok_or_else(|| AppError::not_found("分组不存在"))
}

pub async fn find_meme_or_404(state: &AppState, id: &ObjectId) -> Result<MemeDoc, AppError> {
    state
        .memes()
        .find_one(doc! { "_id": id })
        .await?
        .ok_or_else(|| AppError::not_found("表情不存在"))
}

pub async fn resolve_upload_group(state: &AppState, raw: Option<String>) -> Result<ObjectId, AppError> {
    let raw_group_id = raw.map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
    if let Some(raw_group_id) = raw_group_id {
        let group_id = require_object_id(&raw_group_id)?;
        let group = find_group_or_404(state, &group_id).await?;
        if group.is_favorites {
            return Err(AppError::bad_request("不能上传到收藏分组"));
        }
        if group.is_recent {
            return Err(AppError::bad_request("不能上传到最近使用分组"));
        }
        return Ok(group_id);
    }

    let ungrouped = state.get_ungrouped_group().await?;
    ungrouped
        .map(|g| g.id)
        .ok_or_else(|| AppError::internal("未分组初始化失败"))
}

pub fn is_protected_path(path: &str) -> bool {
    if path.starts_with("/api/_auth/") || path.starts_with("/api/auth/") || path == "/api/health" {
        return false;
    }
    path.starts_with("/api/")
}

pub fn should_block_web(path: &str) -> bool {
    if path == "/ws" || path.starts_with("/api/") {
        return false;
    }
    true
}

pub fn is_valid_object_id(value: &str) -> bool {
    ObjectId::parse_str(value).is_ok()
}
