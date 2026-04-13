use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

const POPUP_LABEL: &str = "popup";

pub fn show_or_create(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    tracing::info!("show_or_create called");
    if let Some(win) = app.get_webview_window(POPUP_LABEL) {
        tracing::info!("Found existing popup window, showing...");
        win.show()?;
        win.set_focus()?;
    } else {
        tracing::info!("No existing popup, creating new...");
        create_popup(app)?;
    }
    Ok(())
}

pub fn show(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    show_or_create(app)
}

pub fn hide(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(win) = app.get_webview_window(POPUP_LABEL) {
        win.hide()?;
    }
    Ok(())
}

fn create_popup(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let (x, y) = match app.primary_monitor()? {
        Some(monitor) => {
            let screen_size = monitor.size();
            let scale = monitor.scale_factor();
            let logical_w = screen_size.width as f64 / scale;
            let logical_h = screen_size.height as f64 / scale;
            // Bottom-right, 20px margin from edges
            let x = logical_w - 400.0 - 20.0;
            let y = logical_h - 500.0 - 60.0;
            tracing::info!("Monitor: {}x{} (logical: {logical_w}x{logical_h}) scale={scale}, popup at ({x}, {y})",
                screen_size.width, screen_size.height);
            (x, y)
        }
        None => {
            tracing::warn!("No primary monitor found, centering popup");
            (500.0, 200.0)
        }
    };

    let url = WebviewUrl::App("index.html".into());
    let win = WebviewWindowBuilder::new(app, POPUP_LABEL, url)
        .title("streambreak")
        .inner_size(400.0, 500.0)
        .position(x, y)
        .resizable(false)
        .decorations(false)
        .always_on_top(true)
        .visible(true)
        .build()?;

    tracing::info!("Popup window created successfully: {:?}", win.label());
    Ok(())
}
