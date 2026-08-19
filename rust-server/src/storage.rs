use std::path::{Path, PathBuf};

use uuid::Uuid;

pub const THUMB_SIZE: u32 = 256;

const EXTENSIONS: [(&str, &str); 5] = [
    ("image/jpeg", ".jpg"),
    ("image/png", ".png"),
    ("image/gif", ".gif"),
    ("image/webp", ".webp"),
    ("image/avif", ".avif"),
];

const MAGIC_SIGNATURES: [(&str, &[u8], Option<usize>, Option<&[u8]>); 4] = [
    ("image/png", &[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], None, None),
    ("image/gif", &[0x47, 0x49, 0x46, 0x38], None, None),
    ("image/jpeg", &[0xff, 0xd8, 0xff], None, None),
    ("image/webp", &[0x52, 0x49, 0x46, 0x46], Some(8), Some(&[0x57, 0x45, 0x42, 0x50])),
];

pub fn sniff_mime_type(data: &[u8]) -> Option<&'static str> {
    for (mime, bytes, offset, trailing) in MAGIC_SIGNATURES {
        if data.len() < bytes.len() || !data.starts_with(bytes) {
            continue;
        }
        if let Some(trailing) = trailing {
            let offset = offset.unwrap_or(bytes.len());
            if data.len() < offset + trailing.len() || &data[offset..offset + trailing.len()] != trailing {
                continue;
            }
        }
        return Some(mime);
    }
    None
}

fn extension_for(mime: &str) -> &'static str {
    for (m, ext) in EXTENSIONS {
        if m == mime {
            return ext;
        }
    }
    ".bin"
}

pub struct Storage {
    dir: PathBuf,
}

impl Storage {
    pub fn new(dir: impl AsRef<Path>) -> Self {
        Self {
            dir: dir.as_ref().to_path_buf(),
        }
    }

    pub fn ensure_dir(&self) -> std::io::Result<()> {
        std::fs::create_dir_all(&self.dir)
    }

    fn path_for(&self, key: &str) -> PathBuf {
        self.dir.join(key)
    }

    pub async fn save(&self, data: &[u8], mime: &str) -> std::io::Result<(String, u64)> {
        let key = format!("{}{}", Uuid::new_v4(), extension_for(mime));
        let path = self.path_for(&key);
        tokio::fs::write(&path, data).await?;
        Ok((key, data.len() as u64))
    }

    pub async fn save_thumb(&self, data: &[u8]) -> std::io::Result<(String, u64)> {
        let key = format!("{}.webp", Uuid::new_v4());
        let path = self.path_for(&key);
        tokio::fs::write(&path, data).await?;
        Ok((key, data.len() as u64))
    }

    pub async fn read(&self, key: &str) -> Option<Vec<u8>> {
        tokio::fs::read(self.path_for(key)).await.ok()
    }

    pub async fn remove(&self, key: &str) {
        let _ = tokio::fs::remove_file(self.path_for(key)).await;
    }
}

/// Generate a 256x256 WebP thumbnail (cover fit, without enlargement), GIF takes first frame.
///
/// Uses `imageops::thumbnail` (built-in multi-step box downscale) for the resize: a single
/// Lanczos3/Triangle resize from e.g. 4096px to 256px is O(n*kernel) and can take seconds in
/// debug builds, while `thumbnail` stays fast even for large inputs.
pub fn generate_thumbnail(data: &[u8]) -> Option<Vec<u8>> {
    let img = image::load_from_memory(data).ok()?;
    let (w, h) = (img.width(), img.height());
    if w == 0 || h == 0 {
        return None;
    }

    let scale = (THUMB_SIZE as f32 / w as f32).max(THUMB_SIZE as f32 / h as f32).min(1.0);
    let nw = ((w as f32 * scale).round() as u32).max(1);
    let nh = ((h as f32 * scale).round() as u32).max(1);

    // fit to the cover intermediate size (same aspect ratio), then center-crop
    let downscaled = image::imageops::thumbnail(&img, nw, nh);

    let cw = THUMB_SIZE.min(downscaled.width());
    let ch = THUMB_SIZE.min(downscaled.height());
    let x = (downscaled.width().saturating_sub(cw)) / 2;
    let y = (downscaled.height().saturating_sub(ch)) / 2;
    let cropped = image::imageops::crop_imm(&downscaled, x, y, cw, ch).to_image();

    let mut out = Vec::new();
    // image crate only supports lossless WebP encoding; quality is not configurable.
    let encoder = image::codecs::webp::WebPEncoder::new_lossless(&mut out);
    cropped.write_with_encoder(encoder).ok()?;
    Some(out)
}
