use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::TrayIconBuilder,
    AppHandle, Manager,
};

use crate::AppState;
use std::sync::Arc;

pub fn setup(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let show = MenuItem::with_id(app, "show", "Show Popup", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, "hide", "Hide Popup", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let lang_en = MenuItem::with_id(app, "lang_en", "English (HN)", true, None::<&str>)?;
    let lang_ko = MenuItem::with_id(app, "lang_ko", "한국어 (GeekNews)", true, None::<&str>)?;
    let lang_menu = Submenu::with_items(app, "Language", true, &[&lang_en, &lang_ko])?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show, &hide, &sep, &lang_menu, &sep2, &quit])?;

    let icon = Image::from_bytes(include_bytes!("../icons/tray-icon@2x.png"))
        .expect("Failed to load tray icon")
        .to_owned();

    TrayIconBuilder::new()
        .icon(icon)
        .icon_as_template(true)
        .menu(&menu)
        .menu_on_left_click(true)
        .tooltip("streambreak")
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "show" => {
                let _ = crate::window::show_or_create(app);
            }
            "hide" => {
                let _ = crate::window::hide(app);
            }
            "lang_en" | "lang_ko" => {
                let lang = if event.id.as_ref() == "lang_en" { "en" } else { "ko" };
                let state = app.state::<Arc<AppState>>();
                let state = state.inner().clone();
                tauri::async_runtime::spawn(async move {
                    let mut config = state.config.lock().await;
                    config.general.language = lang.to_string();
                    let _ = config.save();
                    let config_clone = config.clone();
                    drop(config);
                    let mut cm = state.content_manager.lock().await;
                    cm.update_config(config_clone);
                    if let Err(e) = cm.refresh().await {
                        tracing::warn!("Failed to refresh after language change: {e}");
                    }
                    tracing::info!("Language changed to: {lang}");
                });
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}
