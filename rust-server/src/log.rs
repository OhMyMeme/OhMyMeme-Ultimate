use std::sync::atomic::{AtomicU8, Ordering};

pub const LEVEL_ERROR: u8 = 1;
pub const LEVEL_WARN: u8 = 2;
pub const LEVEL_INFO: u8 = 3;
pub const LEVEL_DEBUG: u8 = 4;

static LEVEL: AtomicU8 = AtomicU8::new(LEVEL_INFO);

pub fn label(level: u8) -> &'static str {
    match level {
        LEVEL_ERROR => "ERROR",
        LEVEL_WARN => "WARN",
        LEVEL_INFO => "INFO",
        _ => "DEBUG",
    }
}

pub fn init() {
    let raw = std::env::var("RUST_LOG").unwrap_or_default().to_ascii_lowercase();
    let lvl = match raw.as_str() {
        "error" => LEVEL_ERROR,
        "warn" | "warning" => LEVEL_WARN,
        "debug" => LEVEL_DEBUG,
        _ => LEVEL_INFO,
    };
    LEVEL.store(lvl, Ordering::Relaxed);
    let ts = now_utc();
    eprintln!("[{ts}] [INFO] 日志级别: {}", label(lvl));
}

pub fn enabled(level: u8) -> bool {
    level <= LEVEL.load(Ordering::Relaxed)
}

pub fn write_log(level: u8, msg: std::fmt::Arguments) {
    if !enabled(level) {
        return;
    }
    let ts = now_utc();
    eprintln!("[{ts}] [{}] {msg}", label(level));
}

/// UTC timestamp `YYYY-MM-DD HH:MM:SS.mmm` (no chrono dependency).
fn now_utc() -> String {
    let ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0) as i64;
    let (secs, millis) = (ms / 1000, ms % 1000);
    let days = secs.div_euclid(86400);
    let tod = secs.rem_euclid(86400);
    let (hh, mm, ss) = (tod / 3600, (tod % 3600) / 60, tod % 60);
    let (y, m, d) = civil_from_days(days);
    format!("{y:04}-{m:02}-{d:02} {hh:02}:{mm:02}:{ss:02}.{millis:03}")
}

/// Days since 1970-01-01 -> (year, month, day). Howard Hinnant's civil_from_days.
fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719468;
    let era = z.div_euclid(146097);
    let doe = z.rem_euclid(146097);
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

#[macro_export]
macro_rules! log_error {
    ($($arg:tt)*) => {
        $crate::log::write_log($crate::log::LEVEL_ERROR, format_args!($($arg)*))
    };
}

#[macro_export]
macro_rules! log_warn {
    ($($arg:tt)*) => {
        $crate::log::write_log($crate::log::LEVEL_WARN, format_args!($($arg)*))
    };
}

#[macro_export]
macro_rules! log_info {
    ($($arg:tt)*) => {
        $crate::log::write_log($crate::log::LEVEL_INFO, format_args!($($arg)*))
    };
}

#[macro_export]
macro_rules! log_debug {
    ($($arg:tt)*) => {
        $crate::log::write_log($crate::log::LEVEL_DEBUG, format_args!($($arg)*))
    };
}
