#[cfg(target_os = "windows")]
mod clipboard {
    use std::os::windows::ffi::OsStrExt;
    use std::path::Path;

    use windows::core::BOOL;
    use windows::Win32::Foundation::{HANDLE, HWND, POINT};
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

            OpenClipboard(None::<HWND>).map_err(|e| format!("OpenClipboard 失败: {e}"))?;
            let _ = EmptyClipboard();
            SetClipboardData(CF_HDROP.0 as u32, Some(HANDLE(hmem.0))).map_err(|e| format!("SetClipboardData 失败: {e}"))?;
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![copy_file_to_clipboard])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
