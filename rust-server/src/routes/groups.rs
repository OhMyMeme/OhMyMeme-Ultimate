use std::collections::HashMap;
use std::sync::Arc;

use axum::extract::{Path, State};
use axum::response::Response;
use axum::Json;
use futures_util::TryStreamExt;
use mongodb::bson::{doc, oid::ObjectId};
use serde::Deserialize;

use crate::error::AppError;
use crate::guard::json_response;
use crate::models::{GroupDoc, GroupDto, RECENT_LIMIT};
use crate::state::{check_system_name, find_group_or_404, require_object_id, AppState};

#[derive(Deserialize)]
pub struct GroupBody {
    pub name: Option<String>,
}

fn extract_stat(doc: &mongodb::bson::Document) -> Option<(i64, Vec<String>)> {
    // 聚合 $sum 返回 double，需兼容 Int32/Int64/Double 三种数值类型
    let count = match doc.get("count")? {
        mongodb::bson::Bson::Int32(v) => *v as i64,
        mongodb::bson::Bson::Int64(v) => *v,
        mongodb::bson::Bson::Double(v) => *v as i64,
        _ => return None,
    };
    let keys = doc
        .get_array("keys")
        .ok()?
        .iter()
        .filter_map(|b| b.as_object_id())
        .map(|id| id.to_string())
        .collect::<Vec<_>>();
    Some((count, keys))
}

pub async fn list_groups(State(state): State<Arc<AppState>>) -> Result<Response, AppError> {
    state.ensure_system_groups().await?;

    let groups: Vec<GroupDoc> = state
        .groups()
        .find(mongodb::bson::Document::new())
        .await?
        .try_collect()
        .await?;

    let stats: Vec<mongodb::bson::Document> = state
        .memes()
        .aggregate(vec![doc! {
            "$group": {
                "_id": "$groupId",
                "count": { "$sum": 1 },
                "keys": { "$topN": { "n": 4, "sortBy": { "createdAt": -1 }, "output": "$_id" } }
            }
        }])
        .await?
        .try_collect()
        .await?;

    let fav_stats: Vec<mongodb::bson::Document> = state
        .memes()
        .aggregate(vec![
            doc! { "$match": { "favorite": true } },
            doc! {
                "$group": {
                    "_id": null,
                    "count": { "$sum": 1 },
                    "keys": { "$topN": { "n": 4, "sortBy": { "createdAt": -1 }, "output": "$_id" } }
                }
            },
        ])
        .await?
        .try_collect()
        .await?;

    let recent_stats: Vec<mongodb::bson::Document> = state
        .memes()
        .aggregate(vec![
            doc! { "$match": { "usedAt": { "$ne": null } } },
            doc! {
                "$group": {
                    "_id": null,
                    "count": { "$sum": 1 },
                    "keys": { "$topN": { "n": 4, "sortBy": { "usedAt": -1 }, "output": "$_id" } }
                }
            },
        ])
        .await?
        .try_collect()
        .await?;

    let mut stat_map: HashMap<ObjectId, (i64, Vec<String>)> = HashMap::new();
    for stat in &stats {
        if let (Some(id), Some(pair)) = (stat.get_object_id("_id").ok(), extract_stat(stat)) {
            stat_map.insert(id, pair);
        }
    }
    let fav_stat = fav_stats.first().and_then(extract_stat);
    let recent_stat = recent_stats.first().and_then(extract_stat);

    let mut list: Vec<(GroupDoc, i64, Vec<String>)> = Vec::new();
    for group in groups {
        if group.is_favorites {
            let (count, keys) = fav_stat.clone().unwrap_or((0, Vec::new()));
            list.push((group, count, keys));
        } else if group.is_recent {
            let (count, keys) = recent_stat.clone().unwrap_or((0, Vec::new()));
            list.push((group, count.min(RECENT_LIMIT), keys));
        } else {
            let (count, keys) = stat_map.get(&group.id).cloned().unwrap_or((0, Vec::new()));
            list.push((group, count, keys));
        }
    }

    list.sort_by(|(a, _, _), (b, _, _)| {
        a.order_rank()
            .cmp(&b.order_rank())
            .then_with(|| a.created_at.cmp(&b.created_at))
    });

    let items: Vec<serde_json::Value> = list
        .into_iter()
        .map(|(group, count, keys)| {
            GroupDto {
                id: group.id.to_string(),
                name: group.name,
                is_favorites: group.is_favorites,
                is_recent: group.is_recent,
                is_ungrouped: group.is_ungrouped,
                count,
                covers: keys.iter().map(|k| format!("/api/memes/{k}/thumb")).collect(),
            }
            .to_json()
        })
        .collect();

    Ok(json_response(serde_json::json!(items)))
}

pub async fn create_group(
    State(state): State<Arc<AppState>>,
    Json(body): Json<GroupBody>,
) -> Result<Response, AppError> {
    let name = body.name.unwrap_or_default().trim().to_string();
    if name.is_empty() {
        return Err(AppError::bad_request("分组名不能为空"));
    }

    check_system_name(&name)?;

    let exists = state
        .groups()
        .find_one(doc! { "name": &name })
        .await?;
    if exists.is_some() {
        return Err(AppError::conflict("分组已存在"));
    }

    let now = mongodb::bson::DateTime::from_millis(crate::auth::now_ms() as i64);
    let group = GroupDoc {
        id: ObjectId::new(),
        name,
        is_favorites: false,
        is_recent: false,
        is_ungrouped: false,
        created_at: Some(now),
        updated_at: Some(now),
    };
    let id = group.id;
    state.groups().insert_one(&group).await?;
    log_info!("创建分组: {} ({id})", group.name);

    state.realtime.broadcast("groups-changed", None);

    Ok(json_response(
        GroupDto {
            id: id.to_string(),
            name: group.name,
            is_favorites: false,
            is_recent: false,
            is_ungrouped: false,
            count: 0,
            covers: Vec::new(),
        }
        .to_json(),
    ))
}

pub async fn rename_group(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(body): Json<GroupBody>,
) -> Result<Response, AppError> {
    let id = require_object_id(&id)?;
    let name = body.name.unwrap_or_default().trim().to_string();
    if name.is_empty() {
        return Err(AppError::bad_request("分组名不能为空"));
    }

    let current = find_group_or_404(&state, &id).await?;
    if current.is_system() {
        return Err(AppError::forbidden("系统分组不可修改"));
    }
    check_system_name(&name)?;

    let exists = state
        .groups()
        .find_one(doc! { "name": &name, "_id": { "$ne": id } })
        .await?;
    if exists.is_some() {
        return Err(AppError::conflict("分组已存在"));
    }

    let group = state
        .groups()
        .find_one_and_update(doc! { "_id": id }, doc! { "$set": { "name": &name } })
        .return_document(mongodb::options::ReturnDocument::After)
        .await?
        .ok_or_else(|| AppError::not_found("分组不存在"))?;

    let count = state
        .memes()
        .count_documents(doc! { "groupId": id })
        .await? as i64;

    log_info!("重命名分组: {id} -> {}", group.name);
    state.realtime.broadcast("groups-changed", None);

    Ok(json_response(
        GroupDto {
            id: group.id.to_string(),
            name: group.name,
            is_favorites: group.is_favorites,
            is_recent: group.is_recent,
            is_ungrouped: group.is_ungrouped,
            count,
            covers: Vec::new(),
        }
        .to_json(),
    ))
}

pub async fn delete_group(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Response, AppError> {
    let id = require_object_id(&id)?;

    let group = find_group_or_404(&state, &id).await?;
    if group.is_system() {
        return Err(AppError::forbidden("系统分组不可删除"));
    }

    let count = state
        .memes()
        .count_documents(doc! { "groupId": id })
        .await?;
    if count > 0 {
        return Err(AppError::conflict("该分组下还有表情，请先移动或删除"));
    }

    state.groups().delete_one(doc! { "_id": id }).await?;
    log_info!("删除分组: {} ({id})", group.name);

    state.realtime.broadcast("groups-changed", None);

    Ok(json_response(serde_json::json!({ "ok": true })))
}
