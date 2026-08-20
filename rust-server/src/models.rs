use mongodb::bson::{doc, DateTime, Document, oid::ObjectId};
use serde::{Deserialize, Serialize};

pub const FAVORITES_GROUP_NAME: &str = "收藏";
pub const RECENT_GROUP_NAME: &str = "最近使用";
pub const UNGROUPED_GROUP_NAME: &str = "未分组";
pub const SYSTEM_GROUP_NAMES: [&str; 3] = [
    FAVORITES_GROUP_NAME,
    RECENT_GROUP_NAME,
    UNGROUPED_GROUP_NAME,
];
pub const RECENT_LIMIT: i64 = 50;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupDoc {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub name: String,
    #[serde(default, rename = "isFavorites")]
    pub is_favorites: bool,
    #[serde(default, rename = "isRecent")]
    pub is_recent: bool,
    #[serde(default, rename = "isUngrouped")]
    pub is_ungrouped: bool,
    #[serde(default, rename = "createdAt")]
    pub created_at: Option<DateTime>,
    #[serde(default, rename = "updatedAt")]
    pub updated_at: Option<DateTime>,
}

impl GroupDoc {
    pub fn is_system(&self) -> bool {
        self.is_favorites || self.is_recent || self.is_ungrouped
    }

    pub fn order_rank(&self) -> i64 {
        if self.is_favorites {
            0
        } else if self.is_recent {
            1
        } else if self.is_ungrouped {
            2
        } else {
            3
        }
    }
}

#[derive(Debug, Clone)]
pub struct GroupDto {
    pub id: String,
    pub name: String,
    pub is_favorites: bool,
    pub is_recent: bool,
    pub is_ungrouped: bool,
    pub count: i64,
    pub covers: Vec<String>,
}

impl GroupDto {
    pub fn to_json(&self) -> serde_json::Value {
        serde_json::json!({
            "id": self.id,
            "name": self.name,
            "isFavorites": self.is_favorites,
            "isRecent": self.is_recent,
            "isUngrouped": self.is_ungrouped,
            "count": self.count,
            "covers": self.covers,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemeDoc {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub name: String,
    #[serde(rename = "groupId")]
    pub group_id: ObjectId,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(rename = "storageKey")]
    pub storage_key: String,
    #[serde(default, rename = "thumbKey")]
    pub thumb_key: Option<String>,
    #[serde(rename = "mimeType")]
    pub mime_type: String,
    #[serde(default)]
    pub size: i64,
    #[serde(default)]
    pub favorite: bool,
    #[serde(default, rename = "usedAt")]
    pub used_at: Option<DateTime>,
    #[serde(default, rename = "createdAt")]
    pub created_at: Option<DateTime>,
    /// 自定义拖动排序权重：数值越大越靠前；None 表示尚未参与过自定义排序。
    /// 降序排序时 BSON 规定数字排在 null/缺失之前，因此手工排过的表情天然优先于历史数据。
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "sortOrder")]
    pub sort_order: Option<i64>,
}

impl MemeDoc {
    pub fn to_json(&self) -> serde_json::Value {
        let created = self
            .created_at
            .and_then(|d| d.try_to_rfc3339_string().ok())
            .unwrap_or_default();
        serde_json::json!({
            "id": self.id.to_string(),
            "name": self.name,
            "groupId": self.group_id.to_string(),
            "tags": self.tags,
            "mimeType": self.mime_type,
            "size": self.size,
            "url": format!("/api/memes/{}/file", self.id),
            "thumbUrl": format!("/api/memes/{}/thumb", self.id),
            "favorite": self.favorite,
            "createdAt": created,
            "sortOrder": self.sort_order,
        })
    }
}

pub fn group_filter_doc(flag: &str) -> Document {
    doc! { flag: true }
}

pub fn ensure_system_group_doc(name: &str, flag: &str) -> Document {
    let mut set_on_insert = doc! { "name": name };
    set_on_insert.insert(flag, true);
    doc! {
        "$setOnInsert": set_on_insert
    }
}
