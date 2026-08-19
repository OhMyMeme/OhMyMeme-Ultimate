use std::net::IpAddr;

#[derive(Debug, Clone)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub mongo_uri: String,
    pub access_token: String,
    pub allowed_origins: Vec<String>,
    pub storage_dir: String,
    pub web_enabled: bool,
}

impl Config {
    pub fn from_env() -> Self {
        let access_token = env_or("ACCESS_TOKEN", "");
        let allowed_origins = env_or("ALLOWED_ORIGINS", "")
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect::<Vec<_>>();

        let mut origins = vec![
            "http://localhost:1420".to_string(),
            "http://tauri.localhost".to_string(),
            "https://tauri.localhost".to_string(),
            "tauri://localhost".to_string(),
        ];
        for origin in allowed_origins {
            if !origins.contains(&origin) {
                origins.push(origin);
            }
        }

        Self {
            host: env_or("HOST", "0.0.0.0"),
            port: env_or("PORT", "3000").parse().unwrap_or(3000),
            mongo_uri: env_or("MONGO_URI", "mongodb://localhost:27017/ohmymeme"),
            access_token,
            allowed_origins: origins,
            storage_dir: env_or("STORAGE_LOCAL_DIR", ".data/uploads/memes"),
            web_enabled: env_or("WEB_ENABLED", "false") == "true",
        }
    }

    pub fn is_auth_configured(&self) -> bool {
        !self.access_token.is_empty()
    }

    pub fn is_origin_allowed(&self, origin: &str) -> bool {
        self.allowed_origins.iter().any(|o| o == origin)
    }
}

fn env_or(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.to_string())
}

pub fn client_ip(headers: &axum::http::HeaderMap, remote: Option<IpAddr>) -> String {
    if let Some(xff) = headers.get("x-forwarded-for").and_then(|v| v.to_str().ok()) {
        if let Some(first) = xff.split(',').next() {
            let first = first.trim();
            if !first.is_empty() {
                return first.to_string();
            }
        }
    }
    match remote {
        Some(ip) => ip.to_string(),
        None => "unknown".to_string(),
    }
}
