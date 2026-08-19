use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

use axum::extract::{ConnectInfo, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::Response;
use axum::Json;
use serde::Deserialize;
use std::collections::HashMap;

use crate::auth::{
    create_session_token, resolve_session_token, session_cookie_header, verify_access_token,
    verify_session_token,
};
use crate::config::client_ip;
use crate::error::AppError;
use crate::guard::json_response;
use crate::state::AppState;

#[derive(Deserialize)]
pub struct LoginBody {
    pub token: Option<String>,
}

pub async fn login(
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<LoginBody>,
) -> Result<Response, AppError> {
    if !state.config.is_auth_configured() {
        log_warn!("登录被拒: 服务端未配置访问密钥（ACCESS_TOKEN）");
        return Err(AppError::new(
            StatusCode::SERVICE_UNAVAILABLE,
            "服务端未配置访问密钥（ACCESS_TOKEN）",
        ));
    }

    let ip = client_ip(&headers, Some(addr.ip()));
    if !state
        .rate_limiter
        .check(&format!("login:{ip}"), 5, Duration::from_secs(60))
    {
        log_warn!("登录限流: 尝试次数过多（5 次/分），来自 {ip}");
        return Err(AppError::too_many_requests("尝试次数过多，请稍后再试"));
    }

    let token = body.token.unwrap_or_default();
    if !verify_access_token(&state.config.access_token, &token) {
        log_warn!("登录失败: 访问密钥不正确，来自 {ip}");
        return Err(AppError::unauthorized("访问密钥不正确"));
    }

    log_info!("登录成功: 来自 {ip}");
    let session_token = create_session_token(&state.config.access_token);
    let cookie = session_cookie_header(&session_token);

    let body = serde_json::json!({ "ok": true, "token": session_token });
    let mut res = json_response(body);
    res.headers_mut().insert("set-cookie", cookie.parse().map_err(|_| AppError::internal("cookie 构造失败"))?);
    Ok(res)
}

pub async fn status(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Response, AppError> {
    let token = resolve_session_token(&headers, params.get("token").map(|s| s.as_str()));
    let authenticated = token
        .as_deref()
        .map(|t| verify_session_token(&state.config.access_token, t))
        .unwrap_or(false);
    Ok(json_response(serde_json::json!({
        "configured": state.config.is_auth_configured(),
        "authenticated": authenticated,
    })))
}
