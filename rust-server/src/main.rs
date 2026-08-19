#[macro_use]
mod log;
mod auth;
mod config;
mod error;
mod guard;
mod models;
mod rate_limit;
mod realtime;
mod routes;
mod state;
mod storage;
mod ws;

use std::sync::Arc;

use config::Config;
use mongodb::options::ClientOptions;
use rate_limit::RateLimiter;
use realtime::Realtime;
use state::{AppState, Overview};
use storage::Storage;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    log::init();
    let config = Config::from_env();

    if !config.is_auth_configured() {
        log_warn!("ACCESS_TOKEN 未配置，登录功能将不可用");
    }

    let mut client_options = match ClientOptions::parse(&config.mongo_uri).await {
        Ok(opts) => opts,
        Err(err) => {
            log_error!("MongoDB 连接串解析失败: {err}");
            std::process::exit(1);
        }
    };
    client_options.app_name = Some("ohmymeme-server".to_string());

    let client = mongodb::Client::with_options(client_options.clone())
        .expect("mongo client 创建失败");
    let db_name = client_options
        .default_database
        .clone()
        .unwrap_or_else(|| "ohmymeme".to_string());
    let db = client.database(&db_name);

    if let Err(err) = client.list_database_names().await {
        log_error!("无法连接 MongoDB（{db_name}）: {err}");
        std::process::exit(1);
    }
    log_info!("MongoDB 已连接: {db_name}");

    let storage = Storage::new(&config.storage_dir);
    if let Err(err) = storage.ensure_dir() {
        log_error!("存储目录创建失败: {err}");
        std::process::exit(1);
    }

    let state = Arc::new(AppState {
        config,
        db,
        storage,
        realtime: Arc::new(Realtime::default()),
        rate_limiter: Arc::new(RateLimiter::default()),
        started_at: std::time::Instant::now(),
        overview_cache: std::sync::Mutex::new(None::<(std::time::Instant, Overview)>),
    });

    if let Err(err) = state.ensure_indexes().await {
        log_warn!("索引创建失败: {err}");
    }

    log_info!(
        "配置: 监听 {}:{} | 存储目录 {} | 鉴权 {} | Web 页面 {} | CORS 来源 {} 个",
        state.config.host,
        state.config.port,
        state.config.storage_dir,
        if state.config.is_auth_configured() { "已配置" } else { "未配置" },
        if state.config.web_enabled { "开放" } else { "关闭" },
        state.config.allowed_origins.len()
    );

    let router = routes::build_router(state.clone());

    let addr = format!("{}:{}", state.config.host, state.config.port);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap_or_else(|err| {
        log_error!("监听 {addr} 失败: {err}");
        std::process::exit(1);
    });
    log_info!("服务已启动: http://{addr}");

    axum::serve(
        listener,
        router.into_make_service_with_connect_info::<std::net::SocketAddr>(),
    )
    .await
    .expect("server error");
}
