use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::extract::{ConnectInfo, Request, State};
use axum::http::header::{HeaderValue, ORIGIN, VARY};
use axum::http::{Method, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use axum::Json;

use crate::auth::{resolve_session_token, verify_session_token};
use crate::config::client_ip;
use crate::error::AppError;
use crate::state::{is_protected_path, should_block_web, AppState};

const ALLOWED_HEADERS: &str = "authorization, content-type";
const ALLOWED_METHODS: &str = "GET, POST, PATCH, DELETE, OPTIONS";

const WEB_DISABLED_HTML: &str = r#"<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Web 访问已禁止</title>
</head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b0f14;color:#e2e8f0;font-family:ui-sans-serif,system-ui,sans-serif">
<main style="text-align:center;padding:24px">
<h1 style="font-size:28px;font-weight:600;margin:0 0 12px">Web 访问已禁止</h1>
<p style="color:#94a3b8;margin:0 0 8px">当前服务仅供 OhMyMeme 桌面端使用。</p>
<p style="color:#64748f;font-size:14px;margin:0">如需开放 Web 端，请设置环境变量 WEB_ENABLED=true 后重启服务。</p>
</main>
</body>
</html>"#;

pub async fn guard(
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    State(state): State<Arc<AppState>>,
    req: Request,
    next: Next,
) -> Response {
    let start = Instant::now();
    let method = req.method().clone();
    let path = req.uri().path().to_string();
    let headers = req.headers().clone();
    let ip = client_ip(&headers, Some(addr.ip()));

    let res = guard_inner(State(state), req, next, &ip).await;

    let status = res.status().as_u16();
    let elapsed = start.elapsed().as_millis();
    if status >= 500 {
        log_error!("{method} {path} -> {status} ({elapsed}ms) 来自 {ip}");
    } else if status >= 400 {
        log_warn!("{method} {path} -> {status} ({elapsed}ms) 来自 {ip}");
    } else {
        log_info!("{method} {path} -> {status} ({elapsed}ms) 来自 {ip}");
    }
    res
}

async fn guard_inner(
    State(state): State<Arc<AppState>>,
    req: Request,
    next: Next,
    ip: &str,
) -> Response {
    let path = req.uri().path().to_string();
    let method = req.method().clone();
    let headers = req.headers().clone();

    // CORS
    let allowed_origin = headers
        .get(ORIGIN)
        .and_then(|v| v.to_str().ok())
        .filter(|origin| state.config.is_origin_allowed(origin))
        .map(|origin| origin.to_string());

    let cors_headers = |mut res: Response| {
        if let Some(origin) = &allowed_origin {
            let h = res.headers_mut();
            if let Ok(v) = HeaderValue::from_str(origin) {
                h.insert("access-control-allow-origin", v);
            }
            if let Ok(v) = HeaderValue::from_str(ALLOWED_HEADERS) {
                h.insert("access-control-allow-headers", v);
            }
            if let Ok(v) = HeaderValue::from_str(ALLOWED_METHODS) {
                h.insert("access-control-allow-methods", v);
            }
            h.insert(VARY, HeaderValue::from_static("origin"));
        }
        res
    };

    // Preflight
    if method == Method::OPTIONS {
        let res = StatusCode::NO_CONTENT.into_response();
        return cors_headers(res);
    }

    // Web disabled (page requests blocked unless enabled)
    if !state.config.web_enabled && should_block_web(&path) {
        let mut res = Response::new(axum::body::Body::from(WEB_DISABLED_HTML));
        *res.status_mut() = StatusCode::FORBIDDEN;
        res.headers_mut().insert(
            "content-type",
            HeaderValue::from_static("text/html; charset=utf-8"),
        );
        return cors_headers(res);
    }

    // Protected API paths: rate limit + auth
    if is_protected_path(&path) {
        if !state
            .rate_limiter
            .check(&format!("api:{ip}"), 600, Duration::from_secs(60))
        {
            log_warn!("限流触发: 接口访问超过 600 次/分，来自 {ip}（{path}）");
            let err = AppError::too_many_requests("请求过于频繁，请稍后再试");
            return cors_headers(err.into_response());
        }

        let query_token = req.uri().query().and_then(|q| {
            q.split('&').find_map(|pair| {
                let mut it = pair.splitn(2, '=');
                if it.next() == Some("token") {
                    it.next().map(|v| v.to_string())
                } else {
                    None
                }
            })
        });
        let token = resolve_session_token(&headers, query_token.as_deref());
        let authenticated = match &token {
            Some(t) => verify_session_token(&state.config.access_token, t),
            None => false,
        };
        if !authenticated {
            log_debug!("鉴权失败: {path} 来自 {ip}");
            let err = AppError::unauthorized("未登录或登录已过期");
            return cors_headers(err.into_response());
        }
    }

    let res = next.run(req).await;
    cors_headers(res)
}

pub fn json_response(value: serde_json::Value) -> Response {
    Json(value).into_response()
}
