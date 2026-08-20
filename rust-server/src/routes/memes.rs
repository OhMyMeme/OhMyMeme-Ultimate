use std::collections::HashMap;
use std::sync::Arc;

use axum::extract::{Multipart, Path, Query, State};
use axum::http::header::{CONTENT_TYPE, RANGE};
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use axum::response::Response;
use axum::Json;
use futures_util::TryStreamExt;
use mongodb::bson::{doc, oid::ObjectId};
use serde::Deserialize;

use crate::auth::now_ms;
use crate::error::AppError;
use crate::guard::json_response;
use crate::models::{MemeDoc, RECENT_LIMIT};
use crate::state::{
    find_group_or_404, find_meme_or_404, is_valid_object_id, require_object_id,
    resolve_upload_group, AppState,
};

const MAX_FILES: usize = 20;
const MAX_FILE_SIZE: usize = 20 * 1024 * 1024;
// 单次请求整体上限 100MB（与桌面端分批一致：20 文件 / 100MB），限制内存驻留峰值
pub const MAX_REQUEST_SIZE: usize = 100 * 1024 * 1024;

fn sanitize_filename(name: &str) -> String {
    let base = name.replace('\\', "/").rsplit('/').next().unwrap_or("").to_string();
    let cleaned: String = base
        .chars()
        .filter(|c| {
            let code = *c as u32;
            code >= 32 && code != 127
        })
        .collect::<String>()
        .trim()
        .to_string();
    if cleaned.is_empty() {
        "未命名".to_string()
    } else {
        cleaned
    }
}

/// Escape regex metacharacters so user search input is treated as literal text.
fn regex_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        if "\\^$.|?*+()[]{}".contains(c) {
            out.push('\\');
        }
        out.push(c);
    }
    out
}

pub async fn list_memes(
    State(state): State<Arc<AppState>>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Response, AppError> {
    let group_id = params
        .get("group")
        .filter(|g| is_valid_object_id(g))
        .map(|g| g.to_string());
    let limit = params
        .get("limit")
        .and_then(|v| v.parse::<i64>().ok())
        .map(|v| v.clamp(1, 100))
        .unwrap_or(48);
    let offset = params
        .get("offset")
        .and_then(|v| v.parse::<i64>().ok())
        .map(|v| v.max(0))
        .unwrap_or(0);

    let mut filter = mongodb::bson::Document::new();
    let mut recent = false;

    // 标签交集筛选：`tags=a,b` → 必须同时含 a 与 b
    if let Some(raw_tags) = params.get("tags") {
        let tags: Vec<String> = raw_tags
            .split(',')
            .map(str::trim)
            .filter(|t| !t.is_empty())
            .map(|t| t.to_string())
            .collect();
        if !tags.is_empty() {
            filter.insert("tags", doc! { "$all": &tags });
        }
    }

    // 搜索：`q=...` 匹配 name / tags（大小写不敏感子串）
    if let Some(q) = params.get("q").map(|v| v.trim()).filter(|v| !v.is_empty()) {
        let escaped = regex_escape(q);
        let re = format!("(?i){}", escaped);
        filter.insert(
            "$or",
            vec![
                doc! { "name": { "$regex": &re } },
                doc! { "tags": { "$regex": &re } },
            ],
        );
    }

    // 只有真实归属分组（未分组 / 自定义分组）支持自定义拖动排序；
    // 收藏与最近使用是跨分组的虚拟视图，必须保持各自的固定排序语义。
    let mut orderable = false;
    if let Some(gid) = &group_id {
        let gid = require_object_id(gid)?;
        let group = find_group_or_404(&state, &gid).await?;
        if group.is_favorites {
            filter.insert("favorite", true);
        } else if group.is_recent {
            filter.insert("usedAt", doc! { "$ne": null });
            recent = true;
        } else {
            filter.insert("groupId", gid);
            orderable = true;
        }
    }

    let effective_limit = if recent {
        (limit.min(RECENT_LIMIT - offset)).max(0)
    } else {
        limit
    };

    let sort = if recent {
        doc! { "usedAt": -1, "createdAt": -1, "_id": 1 }
    } else if orderable {
        doc! { "sortOrder": -1, "createdAt": -1, "_id": 1 }
    } else {
        doc! { "createdAt": -1, "_id": 1 }
    };

    let memes = state.memes();
    let mut find = memes.find(filter.clone()).sort(sort);
    if offset > 0 {
        find = find.skip(offset as u64);
    }
    if effective_limit > 0 {
        find = find.limit(effective_limit);
    }
    let docs: Vec<MemeDoc> = find.await?.try_collect().await?;

    let total = memes.count_documents(filter).await?;

    let items: Vec<serde_json::Value> = docs.iter().map(|d| d.to_json()).collect();
    Ok(json_response(serde_json::json!({
        "items": items,
        "total": if recent { total.min(RECENT_LIMIT as u64) } else { total },
        "limit": limit,
        "offset": offset,
    })))
}

pub async fn upload_memes(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Result<Response, AppError> {
    if let Some(len) = headers
        .get("content-length")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<usize>().ok())
    {
        if len > MAX_REQUEST_SIZE {
            return Err(AppError::new(StatusCode::PAYLOAD_TOO_LARGE, "请求体过大"));
        }
    }

    let mut raw_group_id: Option<String> = None;
    let mut files: Vec<(String, Vec<u8>)> = Vec::new();

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| AppError::bad_request("缺少 multipart 表单数据"))?
    {
        let name = field.name().unwrap_or("").to_string();
        if name == "groupId" {
            if let Ok(bytes) = field.bytes().await {
                raw_group_id = Some(String::from_utf8_lossy(&bytes).trim().to_string());
            }
        } else if name == "files" && field.file_name().is_some() {
            let filename = field.file_name().unwrap_or("").to_string();
            let data = field
                .bytes()
                .await
                .map_err(|_| AppError::bad_request("文件读取失败"))?;
            files.push((filename, data.to_vec()));
        }
    }

    let group_id = resolve_upload_group(&state, raw_group_id).await?;

    if files.is_empty() {
        return Err(AppError::bad_request("未选择文件"));
    }
    if files.len() > MAX_FILES {
        return Err(AppError::bad_request(format!("单次最多上传 {MAX_FILES} 个文件")));
    }

    let mut saved_keys: Vec<String> = Vec::new();
    let mut results: Vec<serde_json::Value> = Vec::new();
    let mut created_any = false;

    let result = async {
        for (filename, data) in &files {
            let name = sanitize_filename(filename);

            if data.is_empty() {
                results.push(serde_json::json!({ "name": name, "status": "failed", "reason": "文件为空" }));
                log_warn!("上传失败: {name}（文件为空）");
                continue;
            }
            if data.len() > MAX_FILE_SIZE {
                results.push(serde_json::json!({ "name": name, "status": "failed", "reason": "文件超过 20MB" }));
                log_warn!("上传失败: {name}（超过 20MB，{} 字节）", data.len());
                continue;
            }

            let Some(mime_type) = crate::storage::sniff_mime_type(data) else {
                results.push(serde_json::json!({ "name": name, "status": "failed", "reason": "格式不支持（仅 PNG/GIF/JPEG/WebP）" }));
                log_warn!("上传失败: {name}（格式不支持）");
                continue;
            };

            let max_edge = crate::storage::MAX_IMAGE_EDGE;
            match crate::storage::probe_dimensions(data) {
                Some((w, h)) if w.max(h) > max_edge => {
                    results.push(serde_json::json!({
                        "name": name,
                        "status": "failed",
                        "reason": format!("分辨率超限（{w}×{h}，最长边不超过 {max_edge}px）")
                    }));
                    log_warn!("上传失败: {name}（分辨率 {w}×{h} 超过 {max_edge}px）");
                    continue;
                }
                Some(_) => {}
                None => {
                    results.push(serde_json::json!({ "name": name, "status": "failed", "reason": "图片损坏或无法解析" }));
                    log_warn!("上传失败: {name}（无法解析图片尺寸）");
                    continue;
                }
            }

            let (storage_key, size) = state.storage.save(data, mime_type).await?;
            saved_keys.push(storage_key.clone());

            let mut thumb_key: Option<String> = None;
            // 缩略图生成是 CPU 密集同步操作，放到 blocking 线程池执行，避免阻塞 Tokio worker
            let thumb_data = data.clone();
            let thumb = tokio::task::spawn_blocking(move || crate::storage::generate_thumbnail(&thumb_data))
                .await
                .ok()
                .flatten();
            if let Some(thumb) = thumb {
                let (tkey, _) = state.storage.save_thumb(&thumb).await?;
                saved_keys.push(tkey.clone());
                thumb_key = Some(tkey);
            }

            let now = mongodb::bson::DateTime::from_millis(now_ms() as i64);
            let meme = MemeDoc {
                id: ObjectId::new(),
                name: name.clone(),
                group_id,
                tags: Vec::new(),
                storage_key: storage_key.clone(),
                thumb_key,
                mime_type: mime_type.to_string(),
                size: size as i64,
                favorite: false,
                used_at: None,
                created_at: Some(now),
                // 新上传不预设排序权重，按 createdAt 落在自定义排序之后
                sort_order: None,
            };
            state.memes().insert_one(&meme).await?;
            results.push(serde_json::json!({ "name": name, "status": "created" }));
            log_info!("上传成功: {name}（{}，{} 字节）到分组 {group_id}", mime_type, data.len());
            created_any = true;
        }
        Ok::<_, AppError>(())
    }
    .await;

    if let Err(err) = result {
        for key in &saved_keys {
            state.storage.remove(key).await;
        }
        return Err(err);
    }

    if created_any {
        state.realtime.broadcast(
            "memes-changed",
            Some(serde_json::json!({ "groupId": group_id.to_string() })),
        );
    }

    Ok(json_response(serde_json::json!({ "results": results })))
}

#[derive(Deserialize)]
pub struct PatchMemeBody {
    pub name: Option<String>,
    #[serde(rename = "groupId")]
    pub group_id: Option<String>,
    pub favorite: Option<bool>,
    pub tags: Option<Vec<String>>,
}

pub async fn get_meme(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Response, AppError> {
    let id = require_object_id(&id)?;
    let doc = find_meme_or_404(&state, &id).await?;
    Ok(json_response(doc.to_json()))
}

pub async fn patch_meme(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(body): Json<PatchMemeBody>,
) -> Result<Response, AppError> {
    let id = require_object_id(&id)?;

    let mut update = mongodb::bson::Document::new();
    let mut unset = mongodb::bson::Document::new();
    if let Some(name) = &body.name {
        let name = name.trim().to_string();
        if !name.is_empty() {
            update.insert("name", name);
        }
    }
    if let Some(gid) = &body.group_id {
        let gid = require_object_id(gid)?;
        let group = find_group_or_404(&state, &gid).await?;
        if group.is_favorites {
            return Err(AppError::bad_request("不能移动到收藏分组"));
        }
        if group.is_recent {
            return Err(AppError::bad_request("不能移动到最近使用分组"));
        }
        update.insert("groupId", gid);
        // 换组后旧分组的排序权重失效，清除以免影响新分组顺序
        unset.insert("sortOrder", "");
    }
    if let Some(fav) = body.favorite {
        update.insert("favorite", fav);
    }
    if let Some(tags) = body.tags {
        // 去重、去空、去首尾空格；单标签超过 30 字符丢弃；整体上限 20 个
        let mut seen = std::collections::HashSet::new();
        let cleaned: Vec<String> = tags
            .into_iter()
            .map(|t| t.trim().to_string())
            .filter(|t| !t.is_empty() && t.chars().count() <= 30)
            .filter(|t| seen.insert(t.clone()))
            .take(20)
            .collect();
        update.insert("tags", cleaned);
    }

    if update.is_empty() {
        return Err(AppError::bad_request("没有需要更新的字段"));
    }

    let mut update_doc = doc! { "$set": update.clone() };
    if !unset.is_empty() {
        update_doc.insert("$unset", unset);
    }

    let doc = state
        .memes()
        .find_one_and_update(doc! { "_id": id }, update_doc)
        .return_document(mongodb::options::ReturnDocument::After)
        .await?
        .ok_or_else(|| AppError::not_found("表情不存在"))?;

    log_info!("更新表情: {id}（{:?}）", update);
    state.realtime.broadcast(
        "memes-changed",
        Some(serde_json::json!({ "groupId": doc.group_id.to_string() })),
    );

    Ok(json_response(doc.to_json()))
}

pub async fn delete_meme(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Response, AppError> {
    let id = require_object_id(&id)?;

    let doc = state
        .memes()
        .find_one_and_delete(doc! { "_id": id })
        .await?
        .ok_or_else(|| AppError::not_found("表情不存在"))?;

    log_info!("删除表情: {id}（{}）", doc.name);
    state.storage.remove(&doc.storage_key).await;
    if let Some(tkey) = &doc.thumb_key {
        state.storage.remove(tkey).await;
    }

    state.realtime.broadcast(
        "memes-changed",
        Some(serde_json::json!({ "groupId": doc.group_id.to_string() })),
    );

    Ok(json_response(serde_json::json!({ "ok": true })))
}

pub async fn meme_file(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    let id = require_object_id(&id)?;
    let doc = find_meme_or_404(&state, &id).await?;

    let data = state
        .storage
        .read(&doc.storage_key)
        .await
        .ok_or_else(|| AppError::not_found("文件不存在"))?;

    let mime = doc.mime_type.clone();
    let size = data.len();

    let base = |status: StatusCode, body: axum::body::Body| -> Response {
        let mut res = Response::new(body);
        *res.status_mut() = status;
        let h = res.headers_mut();
        if let Ok(v) = HeaderValue::from_str(&mime) {
            h.insert(CONTENT_TYPE, v);
        }
        h.insert("x-content-type-options", HeaderValue::from_static("nosniff"));
        h.insert(
            "cache-control",
            HeaderValue::from_static("private, max-age=31536000, immutable"),
        );
        h.insert("accept-ranges", HeaderValue::from_static("bytes"));
        res
    };

    if let Some(range) = headers.get(RANGE).and_then(|v| v.to_str().ok()) {
        let range = range.trim();
        if let Some((start, end)) = parse_range(range) {
            if start < size && end >= start {
                let end = end.min(size - 1);
                let chunk = data[start..=end].to_vec();
                let mut res = base(
                    StatusCode::PARTIAL_CONTENT,
                    axum::body::Body::from(chunk.clone()),
                );
                res.headers_mut().insert(
                    "content-range",
                    HeaderValue::from_str(&format!(
                        "bytes {start}-{}/{}",
                        start + chunk.len() - 1,
                        size
                    ))
                    .unwrap_or_else(|_| HeaderValue::from_static("")),
                );
                if let Ok(v) = HeaderValue::from_str(&chunk.len().to_string()) {
                    res.headers_mut().insert("content-length", v);
                }
                return Ok(res);
            }
        }
        let mut res = base(StatusCode::RANGE_NOT_SATISFIABLE, axum::body::Body::empty());
        res.headers_mut().insert(
            "content-range",
            HeaderValue::from_str(&format!("bytes */{size}")).unwrap_or_else(|_| HeaderValue::from_static("")),
        );
        return Ok(res);
    }

    let mut res = base(StatusCode::OK, axum::body::Body::from(data));
    if let Ok(v) = HeaderValue::from_str(&size.to_string()) {
        res.headers_mut().insert("content-length", v);
    }
    Ok(res)
}

fn parse_range(range: &str) -> Option<(usize, usize)> {
    let rest = range.strip_prefix("bytes=")?;
    let (start, end) = rest.split_once('-')?;
    let start: usize = if start.is_empty() { 0 } else { start.parse().ok()? };
    let end: usize = if end.is_empty() { usize::MAX } else { end.parse().ok()? };
    Some((start, end))
}

pub async fn meme_thumb(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Response, AppError> {
    let id = require_object_id(&id)?;
    let doc = find_meme_or_404(&state, &id).await?;

    let key = doc.thumb_key.clone().unwrap_or_else(|| doc.storage_key.clone());
    let data = state
        .storage
        .read(&key)
        .await
        .ok_or_else(|| AppError::not_found("文件不存在"))?;

    let content_type = if doc.thumb_key.is_some() {
        "image/webp"
    } else {
        doc.mime_type.as_str()
    };

    let data_len = data.len();
    let mut res = Response::new(axum::body::Body::from(data));
    if let Ok(v) = HeaderValue::from_str(content_type) {
        res.headers_mut().insert(CONTENT_TYPE, v);
    }
    res.headers_mut()
        .insert("x-content-type-options", HeaderValue::from_static("nosniff"));
    if let Ok(v) = HeaderValue::from_str(&data_len.to_string()) {
        res.headers_mut().insert("content-length", v);
    }
    res.headers_mut().insert(
        "cache-control",
        HeaderValue::from_static("private, max-age=31536000, immutable"),
    );
    Ok(res)
}

pub async fn mark_used(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Response, AppError> {
    let id = require_object_id(&id)?;

    let used_at = mongodb::bson::DateTime::from_millis(now_ms() as i64);
    let doc = state
        .memes()
        .find_one_and_update(doc! { "_id": id }, doc! { "$set": { "usedAt": used_at } })
        .return_document(mongodb::options::ReturnDocument::After)
        .await?
        .ok_or_else(|| AppError::not_found("表情不存在"))?;

    log_debug!("记录最近使用: {id}");
    state.realtime.broadcast(
        "memes-changed",
        Some(serde_json::json!({ "groupId": doc.group_id.to_string() })),
    );

    Ok(json_response(doc.to_json()))
}

/// 聚合当前所有标签及其使用次数（按次数降序、名称升序），供筛选条/补全使用。
pub async fn list_tags(State(state): State<Arc<AppState>>) -> Result<Response, AppError> {
    let pipeline = vec![
        doc! { "$unwind": "$tags" },
        doc! { "$group": { "_id": "$tags", "count": { "$sum": 1 } } },
        doc! { "$sort": { "count": -1, "_id": 1 } },
    ];
    let mut cursor = state.memes().aggregate(pipeline).await?;
    let mut tags: Vec<serde_json::Value> = Vec::new();
    while let Some(doc) = cursor.try_next().await? {
        let name = doc.get_str("_id").unwrap_or_default().to_string();
        // 聚合 $sum 返回 double，需兼容 Int32/Int64/Double 三种数值类型
        let count = match doc.get("count") {
            Some(mongodb::bson::Bson::Int32(n)) => *n as i64,
            Some(mongodb::bson::Bson::Int64(n)) => *n,
            Some(mongodb::bson::Bson::Double(n)) => *n as i64,
            _ => 0,
        };
        if !name.is_empty() {
            tags.push(serde_json::json!({ "name": name, "count": count }));
        }
    }
    Ok(json_response(serde_json::json!(tags)))
}

/// 拖动排序时只需要 id 与排序字段，单独定义以便安全使用投影查询
#[derive(Debug, Clone, Deserialize)]
pub struct OrderRow {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    #[serde(default, rename = "sortOrder")]
    pub sort_order: Option<i64>,
}

#[derive(Deserialize)]
pub struct ReorderBody {
    /// 被拖动的表情 id
    pub id: Option<String>,
    /// 落点：把 id 放到 beforeId 之前；为空表示移动到末尾
    #[serde(rename = "beforeId")]
    pub before_id: Option<String>,
}

/// 拖动排序：把一个表情移动到另一个表情之前（beforeId 为空则移到末尾）。
///
/// 采用「相对落点」而非整表 id 列表，因为前端网格是无限滚动分页的，
/// 只提交已加载的一段 id 会让未加载部分的位置变得不确定。
///
/// 排序权重 sortOrder 越大越靠前。为避免频繁重排整个分组，这里只重写
/// 受影响的表情：给被拖动项取一个落在前后邻居之间的权重；当空隙不足时，
/// 才对该分组按当前顺序整体重新编号（步长 1024）后再插入。
pub async fn reorder_memes(
    State(state): State<Arc<AppState>>,
    Json(body): Json<ReorderBody>,
) -> Result<Response, AppError> {
    const STEP: i64 = 1024;

    let id = body
        .id
        .as_deref()
        .map(require_object_id)
        .transpose()?
        .ok_or_else(|| AppError::bad_request("缺少要移动的表情"))?;
    let before_id = body
        .before_id
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(require_object_id)
        .transpose()?;

    if Some(id) == before_id {
        return Err(AppError::bad_request("落点不能是自身"));
    }

    let moving = find_meme_or_404(&state, &id).await?;
    let group_id = moving.group_id;

    // 目标必须与被拖动项同组，避免跨分组写入
    if let Some(before) = &before_id {
        let target = find_meme_or_404(&state, before).await?;
        if target.group_id != group_id {
            return Err(AppError::bad_request("落点不在同一分组"));
        }
    }

    // 该分组当前顺序（与 list_memes 的可排序分支保持一致）。
    // 只取排序所需字段，避免把整组文档（可能上千条）全量读进内存。
    // 用独立的轻量结构体接收：MemeDoc 的 name/storageKey/mimeType 没有 serde 默认值，
    // 投影后无法反序列化。
    let ordered: Vec<OrderRow> = state
        .memes()
        .clone_with_type::<OrderRow>()
        .find(doc! { "groupId": group_id })
        .sort(doc! { "sortOrder": -1, "createdAt": -1, "_id": 1 })
        .projection(doc! { "_id": 1, "sortOrder": 1, "createdAt": 1 })
        .await?
        .try_collect()
        .await?;

    // 去掉被拖动项后，按落点算出插入位置
    let rest: Vec<&OrderRow> = ordered.iter().filter(|m| m.id != id).collect();
    let insert_at = match &before_id {
        Some(before) => rest
            .iter()
            .position(|m| m.id == *before)
            .ok_or_else(|| AppError::conflict("列表已变化，请刷新后重试"))?,
        None => rest.len(),
    };

    // 邻居：prev 在前（权重更大），next 在后（权重更小）。
    // 必须区分「没有邻居」和「邻居还没有权重」——历史数据的 sortOrder 为空，
    // 若把两者都当成 None，往未编号的列表中间拖动就会被误判成插入队首。
    let prev = insert_at.checked_sub(1).and_then(|i| rest.get(i)).copied();
    let next = rest.get(insert_at).copied();
    let prev_order = prev.and_then(|m| m.sort_order);
    let next_order = next.and_then(|m| m.sort_order);

    let target_order = match (prev, next) {
        // 前后都有邻居：只有两侧都已编号且中间留有空隙时才能只写一条记录
        (Some(_), Some(_)) => match (prev_order, next_order) {
            (Some(p), Some(n)) if p - n > 1 => Some(n + (p - n) / 2),
            // 任一侧尚未编号（历史数据），无法安全取中值 → 整体重排
            _ => None,
        },
        // 插到队首：比后继再高一个步长；后继未编号则需整体重排
        (None, Some(_)) => next_order.map(|n| n.saturating_add(STEP)),
        // 插到队尾：比前驱再低一个步长；前驱未编号则需整体重排
        (Some(_), None) => prev_order.map(|p| p - STEP),
        // 分组内只有这一个表情
        (None, None) => Some(STEP),
    };

    if let Some(order) = target_order {
        state
            .memes()
            .update_one(doc! { "_id": id }, doc! { "$set": { "sortOrder": order } })
            .await?;
    } else {
        // 重新编号：按目标顺序从高到低均匀分配，一次 update_many 无法表达不同值，
        // 因此逐条写入；仅在空隙耗尽时才会走到这里，属于低频路径。
        let mut final_ids: Vec<ObjectId> = rest.iter().map(|m| m.id).collect();
        final_ids.insert(insert_at, id);
        let total = final_ids.len() as i64;
        for (index, mid) in final_ids.iter().enumerate() {
            let order = (total - index as i64) * STEP;
            state
                .memes()
                .update_one(doc! { "_id": mid }, doc! { "$set": { "sortOrder": order } })
                .await?;
        }
    }

    log_info!("拖动排序: 表情 {id} 移动到 {:?} 之前（分组 {group_id}）", before_id);
    state.realtime.broadcast(
        "memes-changed",
        Some(serde_json::json!({ "groupId": group_id.to_string() })),
    );

    Ok(json_response(serde_json::json!({ "ok": true })))
}

#[derive(Deserialize)]
pub struct BatchBody {
    pub ids: Option<Vec<String>>,
    pub action: Option<String>,
    #[serde(rename = "groupId")]
    pub group_id: Option<String>,
}

pub async fn batch_memes(
    State(state): State<Arc<AppState>>,
    Json(body): Json<BatchBody>,
) -> Result<Response, AppError> {
    let ids: Vec<ObjectId> = body
        .ids
        .unwrap_or_default()
        .into_iter()
        .filter(|id| is_valid_object_id(id))
        .filter_map(|id| ObjectId::parse_str(&id).ok())
        .collect();
    if ids.is_empty() {
        return Err(AppError::bad_request("未选择表情"));
    }

    match body.action.as_deref() {
        Some("move") => {
            let group_id = body
                .group_id
                .as_deref()
                .map(require_object_id)
                .transpose()?
                .ok_or_else(|| AppError::bad_request("无效的分组"))?;
            let group = find_group_or_404(&state, &group_id).await?;
            if group.is_favorites {
                return Err(AppError::bad_request("不能移动到收藏分组"));
            }
            if group.is_recent {
                return Err(AppError::bad_request("不能移动到最近使用分组"));
            }

            let result = state
                .memes()
                .update_many(
                    doc! { "_id": { "$in": &ids } },
                    doc! { "$set": { "groupId": group_id }, "$unset": { "sortOrder": "" } },
                )
                .await?;

            log_info!("批量移动: {} 个表情到分组 {group_id}", ids.len());
            state.realtime.broadcast(
                "memes-changed",
                Some(serde_json::json!({ "groupId": group_id.to_string() })),
            );

            Ok(json_response(serde_json::json!({ "moved": result.modified_count })))
        }
        Some("delete") => {
            let memes: Vec<MemeDoc> = state
                .memes()
                .find(doc! { "_id": { "$in": &ids } })
                .projection(doc! { "storageKey": 1, "thumbKey": 1 })
                .await?
                .try_collect()
                .await?;

            let result = state
                .memes()
                .delete_many(doc! { "_id": { "$in": &ids } })
                .await?;

            log_info!("批量删除: {} 个表情（{} 个已删除）", ids.len(), result.deleted_count);
            for meme in &memes {
                state.storage.remove(&meme.storage_key).await;
                if let Some(tkey) = &meme.thumb_key {
                    state.storage.remove(tkey).await;
                }
            }

            state.realtime.broadcast("memes-changed", None);

            Ok(json_response(serde_json::json!({ "deleted": result.deleted_count })))
        }
        _ => Err(AppError::bad_request("无效的操作")),
    }
}
