use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

const POPUP_LABEL: &str = "popup";

pub fn show_or_create(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    tracing::info!("show_or_create called");
    // Always close and recreate. Showing an existing hidden window causes macOS to switch
    // the user to whatever Space that window was last on. A freshly created window always
    // lands on the currently active Space.
    if let Some(win) = app.get_webview_window(POPUP_LABEL) {
        tracing::info!("Closing existing popup to recreate on active Space");
        win.close()?;
    }
    create_popup(app)?;
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

    #[cfg(target_os = "macos")]
    set_move_to_active_space(&win);

    tracing::info!("Popup window created successfully: {:?}", win.label());
    Ok(())
}

// On macOS, newly created windows land on whatever Space the app was first opened on.
// NSWindowCollectionBehaviorMoveToActiveSpace (1 << 1) makes the window jump to the
// currently active Space each time it becomes visible, so split-desktop users see it
// on the right side.
#[cfg(target_os = "macos")]
fn set_move_to_active_space(win: &tauri::WebviewWindow) {
    use objc::runtime::Object;
    use objc::{msg_send, sel, sel_impl};
    if let Ok(ptr) = win.ns_window() {
        unsafe {
            let ns_window = ptr as *mut Object;
            let _: () = msg_send![ns_window, setCollectionBehavior: 2u64];
        }
    }
}
