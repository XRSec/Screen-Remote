use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

fn urlencode(s: &str) -> String {
    let mut result = String::with_capacity(s.len() * 3);
    for b in s.bytes() {
        match b {
            b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                result.push(b as char);
            }
            _ => {
                use std::fmt::Write;
                let _ = write!(result, "%{:02X}", b);
            }
        }
    }
    result
}

pub fn make_detached_window_label(session_id: &str, screen_id: &str) -> String {
    let raw = format!("detached_{}_{}", session_id, screen_id);
    raw.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

#[tauri::command]
pub fn open_detached_screen_window(
    app: AppHandle,
    session_id: String,
    screen_id: String,
    title: String,
    width: u32,
    height: u32,
) -> Result<(), String> {
    let label = make_detached_window_label(&session_id, &screen_id);

    // If window already exists, bring it to front and focus
    if let Some(existing) = app.get_webview_window(&label) {
        let _ = existing.unminimize();
        let _ = existing.show();
        existing.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    // Determine initial dimensions preserving aspect ratio
    let (win_width, win_height) = if width > 0 && height > 0 {
        let aspect_ratio = width as f64 / height as f64;
        if aspect_ratio > 1.0 {
            // Landscape (e.g. tablet / virtual screen 1200x800)
            let h = 580.0;
            let w = (h * aspect_ratio).clamp(480.0, 1200.0);
            (w, h)
        } else {
            // Portrait (e.g. phone 1080x2400)
            let h = 760.0;
            let w = (h * aspect_ratio).clamp(340.0, 650.0);
            (w, h)
        }
    } else {
        (420.0, 780.0)
    };

    let is_virtual = screen_id != "primary";
    #[cfg(debug_assertions)]
    let webview_url = {
        let raw_url = format!(
            "http://localhost:1420/index.html?detached=true&sessionId={}&screenId={}&title={}&isVirtualDisplay={}",
            urlencode(&session_id),
            urlencode(&screen_id),
            urlencode(&title),
            is_virtual,
        );
        let parsed = tauri::Url::parse(&raw_url).map_err(|e| e.to_string())?;
        WebviewUrl::External(parsed)
    };

    #[cfg(not(debug_assertions))]
    let webview_url = {
        let raw_url = format!(
            "tauri://localhost/index.html?detached=true&sessionId={}&screenId={}&title={}&isVirtualDisplay={}",
            urlencode(&session_id),
            urlencode(&screen_id),
            urlencode(&title),
            is_virtual,
        );
        match tauri::Url::parse(&raw_url) {
            Ok(parsed) => WebviewUrl::CustomProtocol(parsed),
            Err(_) => WebviewUrl::App(std::path::PathBuf::from("index.html")),
        }
    };

    let builder = WebviewWindowBuilder::new(&app, &label, webview_url)
        .title(&title)
        .inner_size(win_width, win_height)
        .min_inner_size(260.0, 360.0)
        .resizable(true)
        .center();

    #[cfg(target_os = "macos")]
    let builder = builder
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .hidden_title(true);

    let win = builder.build().map_err(|e| e.to_string())?;

    // Emit event when window is closed/destroyed
    let app_handle = app.clone();
    let s_id = session_id.clone();
    let sc_id = screen_id.clone();
    win.on_window_event(move |event| {
        if let tauri::WindowEvent::Destroyed = event {
            let _ = app_handle.emit(
                "detached_screen_closed",
                serde_json::json!({
                    "session_id": s_id,
                    "screen_id": sc_id,
                }),
            );
        }
    });

    Ok(())
}

#[tauri::command]
pub fn close_detached_screen_window(
    app: AppHandle,
    session_id: String,
    screen_id: String,
) -> Result<(), String> {
    let label = make_detached_window_label(&session_id, &screen_id);
    if let Some(win) = app.get_webview_window(&label) {
        win.close().map_err(|e| e.to_string())?;
    }

    // Also emit detached_screen_closed event immediately so UI recovers without delay
    let _ = app.emit(
        "detached_screen_closed",
        serde_json::json!({
            "session_id": session_id,
            "screen_id": screen_id,
        }),
    );

    Ok(())
}
