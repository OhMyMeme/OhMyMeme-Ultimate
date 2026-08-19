use hmac::{Hmac, Mac};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

pub const SESSION_TTL_MS: u128 = 1000 * 60 * 60 * 24 * 7;
pub const SESSION_COOKIE_NAME: &str = "nuxt-session";

pub fn now_ms() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

fn sign_expires(access_token: &str, expires_at: &str) -> String {
    let mut mac = HmacSha256::new_from_slice(access_token.as_bytes()).expect("hmac key");
    mac.update(expires_at.as_bytes());
    hex::encode(mac.finalize().into_bytes())
}

pub fn verify_access_token(access_token: &str, input: &str) -> bool {
    if access_token.is_empty() || input.is_empty() {
        return false;
    }
    // constant-time comparison
    let a = access_token.as_bytes();
    let b = input.as_bytes();
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

pub fn create_session_token(access_token: &str) -> String {
    let expires_at = (now_ms() + SESSION_TTL_MS).to_string();
    format!("{expires_at}.{}", sign_expires(access_token, &expires_at))
}

pub fn verify_session_token(access_token: &str, token: &str) -> bool {
    if token.is_empty() || access_token.is_empty() {
        return false;
    }
    let Some(dot) = token.find('.') else {
        return false;
    };
    if dot == 0 {
        return false;
    }
    let (expires_at, signature) = token.split_at(dot);
    let signature = &signature[1..];
    let Ok(expires_ms) = expires_at.parse::<u128>() else {
        return false;
    };
    if expires_ms < now_ms() {
        return false;
    }
    let expected = sign_expires(access_token, expires_at);
    // constant-time comparison
    let a = expected.as_bytes();
    let b = signature.as_bytes();
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

/// Resolve a session token from Authorization header, query param, or cookie.
pub fn resolve_session_token(
    headers: &axum::http::HeaderMap,
    query_token: Option<&str>,
) -> Option<String> {
    if let Some(auth) = headers.get("authorization").and_then(|v| v.to_str().ok()) {
        if let Some(rest) = auth.strip_prefix("Bearer ") {
            let rest = rest.trim();
            if !rest.is_empty() {
                return Some(rest.to_string());
            }
        }
    }

    if let Some(token) = query_token {
        if !token.is_empty() {
            return Some(token.to_string());
        }
    }

    if let Some(cookie) = headers.get("cookie").and_then(|v| v.to_str().ok()) {
        for part in cookie.split(';') {
            let part = part.trim();
            if let Some(value) = part.strip_prefix(&format!("{SESSION_COOKIE_NAME}=")) {
                let value = value.trim();
                if !value.is_empty() {
                    return Some(value.to_string());
                }
            }
        }
    }

    None
}

pub fn session_cookie_header(token: &str) -> String {
    format!(
        "{SESSION_COOKIE_NAME}={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age={}",
        SESSION_TTL_MS / 1000
    )
}
