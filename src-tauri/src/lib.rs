use std::fs;
use tauri::{AppHandle, DragDropEvent, Emitter, Manager, WebviewUrl, WebviewWindowBuilder, Window, WindowEvent};

/// Opens or focuses the secondary presenter notes window.
/// MUST be `async` on Windows (WebView2) so `WebviewWindowBuilder::build()` runs off the
/// main Win32 UI event-loop thread and avoids deadlocking `CreateCoreWebView2Controller`.
#[tauri::command]
async fn open_notes_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("notes_popout") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(());
    }

    WebviewWindowBuilder::new(
        &app,
        "notes_popout",
        WebviewUrl::default(),
    )
    .title("Presenter Notes - Dual-Screen View")
    .inner_size(960.0, 680.0)
    .min_inner_size(600.0, 450.0)
    .resizable(true)
    .maximizable(true)
    .minimizable(true)
    .closable(true)
    .focused(true)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Closes the secondary presenter notes window if it is currently open.
#[tauri::command]
async fn close_notes_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("notes_popout") {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn pick_pdf_file() -> Option<String> {
    let file = rfd::FileDialog::new()
        .add_filter("PDF Document", &["pdf"])
        .pick_file();

    file.map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
async fn save_file_dialog(default_name: Option<String>, extension: Option<String>) -> Option<String> {
    let mut dialog = rfd::FileDialog::new();
    if let Some(ref name) = default_name {
        dialog = dialog.set_file_name(name);
    }
    if let Some(ref ext) = extension {
        dialog = dialog.add_filter(ext, &[ext.as_str()]);
    }
    dialog.save_file().map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
fn read_pdf_file(path: String) -> Result<Vec<u8>, String> {
    fs::read(&path).map_err(|e| format!("Failed to read file {}: {}", path, e))
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| format!("Failed to write file {}: {}", path, e))
}

#[tauri::command]
async fn toggle_fullscreen(window: Window) -> Result<bool, String> {
    let is_fs = window.is_fullscreen().map_err(|e| e.to_string())?;
    window.set_fullscreen(!is_fs).map_err(|e| e.to_string())?;
    Ok(!is_fs)
}

#[tauri::command]
async fn set_fullscreen(window: Window, fullscreen: bool) -> Result<(), String> {
    window.set_fullscreen(fullscreen).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .on_window_event(|window, event| {
            // When the main presentation window is closed, automatically close the popout notes window
            if window.label() == "main" {
                match event {
                    WindowEvent::Destroyed => {
                        if let Some(notes_win) = window.app_handle().get_webview_window("notes_popout") {
                            let _ = notes_win.close();
                        }
                    }
                    WindowEvent::DragDrop(DragDropEvent::Drop { paths, .. }) => {
                        let path_strings: Vec<String> = paths
                            .iter()
                            .map(|p| p.to_string_lossy().to_string())
                            .collect();
                        let _ = window.app_handle().emit("native-file-drop", path_strings);
                    }
                    _ => {}
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            pick_pdf_file,
            save_file_dialog,
            read_pdf_file,
            write_text_file,
            toggle_fullscreen,
            set_fullscreen,
            open_notes_window,
            close_notes_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_greet() {
        let msg = greet("Presenter");
        assert_eq!(msg, "Hello, Presenter! You've been greeted from Rust!");
    }

    #[test]
    fn test_webview_url() {
        let default_url = WebviewUrl::default();
        assert_eq!(default_url, WebviewUrl::App("index.html".into()));
    }

    #[test]
    fn test_file_write_and_read() {
        let temp_dir = std::env::temp_dir();
        let file_path = temp_dir.join(format!("test_markdown_note_{}.md", std::process::id()));
        let content = "# Markdown Test Handout\nThis is a sample presenter note.";

        let write_res = write_text_file(file_path.to_string_lossy().to_string(), content.to_string());
        assert!(write_res.is_ok());

        let read_res = read_pdf_file(file_path.to_string_lossy().to_string());
        assert!(read_res.is_ok());
        let read_bytes = read_res.unwrap();
        assert_eq!(read_bytes, content.as_bytes());

        let _ = fs::remove_file(file_path);
    }
}
