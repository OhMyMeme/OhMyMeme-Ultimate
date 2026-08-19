#[cfg(target_os = "windows")]
mod clipboard {
    use std::os::windows::ffi::OsStrExt;
    use std::path::Path;

    use windows::core::BOOL;
    use windows::Win32::Foundation::{HANDLE, HWND, POINT, GlobalFree};
    use windows::Win32::System::DataExchange::{CloseClipboard, EmptyClipboard, OpenClipboard, SetClipboardData};
    use windows::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE};
    use windows::Win32::System::Ole::CF_HDROP;
    use windows::Win32::UI::Shell::DROPFILES;

    pub fn write_file_drop(path: &Path) -> Result<(), String> {
        let mut wide: Vec<u16> = path.as_os_str().encode_wide().collect();
        wide.push(0);
        wide.push(0);

        let header_size = std::mem::size_of::<DROPFILES>();
        let total = header_size + wide.len() * std::mem::size_of::<u16>();
        eprintln!("[copy] DROPFILES header={header_size} total={total} path={}", path.display());

        unsafe {
            let hmem = GlobalAlloc(GMEM_MOVEABLE, total).map_err(|e| format!("GlobalAlloc 失败: {e}"))?;
            let ptr = GlobalLock(hmem);
            if ptr.is_null() {
                let _ = GlobalFree(Some(hmem));
                return Err("GlobalLock 返回空指针".to_string());
            }

            let dropfiles = ptr.cast::<DROPFILES>();
            (*dropfiles).pFiles = header_size as u32;
            (*dropfiles).pt = POINT::default();
            (*dropfiles).fNC = BOOL(0);
            (*dropfiles).fWide = BOOL(1);
            std::ptr::copy_nonoverlapping(wide.as_ptr(), ptr.add(header_size).cast::<u16>(), wide.len());
            let _ = GlobalUnlock(hmem);
            eprintln!("[copy] 已写入 DROPFILES 内存块");

            if let Err(e) = OpenClipboard(None::<HWND>) {
                let _ = GlobalFree(Some(hmem));
                return Err(format!("OpenClipboard 失败: {e}"));
            }
            let _ = EmptyClipboard();
            if let Err(e) = SetClipboardData(CF_HDROP.0 as u32, Some(HANDLE(hmem.0))) {
                let _ = CloseClipboard();
                let _ = GlobalFree(Some(hmem));
                return Err(format!("SetClipboardData 失败: {e}"));
            }
            let _ = CloseClipboard();
            eprintln!("[copy] CF_HDROP 已写入剪贴板");
        }

        Ok(())
    }

    pub fn write_image_file_to_clipboard(bytes: &[u8], extension: &str) -> Result<(), String> {
        eprintln!("[copy] 收到 {} 字节，扩展名 {}", bytes.len(), extension);

        let dir = std::env::temp_dir().join("ohmymeme_clipboard");
        std::fs::create_dir_all(&dir).map_err(|e| format!("创建临时目录失败: {e}"))?;

        if let Ok(entries) = std::fs::read_dir(&dir) {
            let now = std::time::SystemTime::now();
            for entry in entries.flatten() {
                if let Ok(modified) = entry.metadata().and_then(|m| m.modified()) {
                    if now.duration_since(modified).map(|d| d.as_secs() > 3600).unwrap_or(false) {
                        let _ = std::fs::remove_file(entry.path());
                    }
                }
            }
        }

        let unique = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let file_path = dir.join(format!("clip_{}.{}", unique, extension.trim_start_matches('.')));
        std::fs::write(&file_path, bytes).map_err(|e| format!("写入临时文件失败: {e}"))?;
        eprintln!("[copy] 临时文件已写入: {}", file_path.display());

        write_file_drop(&file_path)
    }
}

#[tauri::command]
fn copy_file_to_clipboard(bytes: Vec<u8>, extension: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        clipboard::write_image_file_to_clipboard(&bytes, &extension)
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (bytes, extension);
        Err("复制文件到剪贴板仅支持 Windows".to_string())
    }
}

#[cfg(desktop)]
use std::sync::atomic::{AtomicBool, Ordering};

#[cfg(desktop)]
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, LogicalSize, Manager,
};
#[cfg(desktop)]
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

#[cfg(desktop)]
const DEFAULT_SHORTCUT: &str = "ctrl+alt+n";

#[cfg(desktop)]
static MAIN_WINDOW_SHOWN: AtomicBool = AtomicBool::new(true);

#[cfg(desktop)]
#[tauri::command]
fn set_global_shortcut(app: tauri::AppHandle, shortcut: String) -> Result<(), String> {
    let gs = app.global_shortcut();
    gs.unregister_all().map_err(|e| format!("取消原快捷键失败: {e}"))?;
    if let Err(e) = gs.register(shortcut.as_str()) {
        let _ = gs.register(DEFAULT_SHORTCUT);
        return Err(format!("注册快捷键失败: {e}"));
    }
    Ok(())
}

#[cfg(not(desktop))]
#[tauri::command]
fn set_global_shortcut(_app: tauri::AppHandle, _shortcut: String) -> Result<(), String> {
    Err("全局快捷键仅支持桌面端".to_string())
}

#[cfg(desktop)]
fn show_main_window(app: &tauri::AppHandle) {
    MAIN_WINDOW_SHOWN.store(true, Ordering::SeqCst);
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[cfg(desktop)]
fn hide_main_window(app: &tauri::AppHandle) {
    MAIN_WINDOW_SHOWN.store(false, Ordering::SeqCst);
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

#[cfg(desktop)]
fn toggle_main_window(app: &tauri::AppHandle) {
    if MAIN_WINDOW_SHOWN.swap(false, Ordering::SeqCst) {
        hide_main_window(app);
    } else {
        show_main_window(app);
    }
}

#[cfg(desktop)]
fn open_favorites(app: &tauri::AppHandle) {
    if MAIN_WINDOW_SHOWN.swap(false, Ordering::SeqCst) {
        hide_main_window(app);
        return;
    }
    show_main_window(app);
    let _ = app.emit("open-favorites", ());
}

#[cfg(desktop)]
fn clamp_window_to_monitor(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let Ok(Some(monitor)) = window.current_monitor() else {
        return;
    };
    let scale = monitor.scale_factor();
    let width = (monitor.size().width as f64 / scale) as u32;
    let height = (monitor.size().height as f64 / scale) as u32;
    let width = width.min(960);
    let height = height.min(600);
    if width == 0 || height == 0 {
        return;
    }
    let _ = window.set_size(LogicalSize::new(width as f64, height as f64));
    let _ = window.set_min_size(Some(LogicalSize::new(width as f64, height as f64)));
}

#[cfg(desktop)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if let ShortcutState::Pressed = event.state {
                        open_favorites(app);
                    }
                })
                .build(),
        )
        .setup(|app| {
            clamp_window_to_monitor(app.handle());

            if let Err(e) = app.global_shortcut().register(DEFAULT_SHORTCUT) {
                eprintln!("[shortcut] 注册全局快捷键 {DEFAULT_SHORTCUT} 失败: {e}");
            }

            let show = MenuItem::with_id(app, "show", "显示 OhMyMeme", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            let mut tray = TrayIconBuilder::with_id("main")
                .menu(&menu)
                .show_menu_on_left_click(false);
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main_window(app),
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                MAIN_WINDOW_SHOWN.store(false, Ordering::SeqCst);
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![copy_file_to_clipboard, set_global_shortcut])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(not(desktop))]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|_app| Ok(()))
        .invoke_handler(tauri::generate_handler![copy_file_to_clipboard, set_global_shortcut])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
