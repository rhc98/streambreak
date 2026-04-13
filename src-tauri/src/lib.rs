pub mod api;
pub mod cli;
pub mod config;
pub mod content;
pub mod timer;
pub mod tray;
pub mod window;

use std::sync::Arc;
use tokio::sync::Mutex;

pub struct AppState {
    pub timer: Arc<Mutex<timer::Timer>>,
    pub config: Arc<Mutex<config::Config>>,
    pub content_manager: Arc<Mutex<content::ContentManager>>,
}

#[tauri::command]
async fn get_status(
    state: tauri::State<'_, Arc<AppState>>,
) -> Result<serde_json::Value, String> {
    let timer = state.timer.lock().await;
    let status = timer.status();
    Ok(serde_json::json!({
        "elapsed_ms": status.elapsed_ms,
        "popup_visible": status.popup_visible,
        "mode": status.mode,
    }))
}

#[tauri::command]
async fn get_content_list(
    state: tauri::State<'_, Arc<AppState>>,
) -> Result<Vec<content::ContentItem>, String> {
    let mut cm = state.content_manager.lock().await;
    cm.get_items().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn hide_popup(app: tauri::AppHandle) -> Result<(), String> {
    window::hide(&app).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_language(
    state: tauri::State<'_, Arc<AppState>>,
) -> Result<String, String> {
    let config = state.config.lock().await;
    Ok(config.general.language.clone())
}

#[tauri::command]
async fn set_language(
    state: tauri::State<'_, Arc<AppState>>,
    language: String,
) -> Result<(), String> {
    let config_clone = {
        let mut config = state.config.lock().await;
        config.general.language = language;
        config.save().map_err(|e| e.to_string())?;
        config.clone()
    };
    // Refresh content with new language feeds
    let mut cm = state.content_manager.lock().await;
    cm.update_config(config_clone);
    cm.refresh().await.map_err(|e| e.to_string())?;
    Ok(())
}

pub fn run() {
    tracing_subscriber::fmt::init();

    let config = config::Config::load();
    let threshold = config.general.threshold_seconds;
    let config = Arc::new(Mutex::new(config));
    let timer = Arc::new(Mutex::new(timer::Timer::new(threshold)));
    let content_manager = Arc::new(Mutex::new(content::ContentManager::new_default()));

    let app_state = Arc::new(AppState {
        timer: timer.clone(),
        config: config.clone(),
        content_manager,
    });

    let app_state_for_api = app_state.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            get_status,
            get_content_list,
            hide_popup,
            get_language,
            set_language,
        ])
        .setup(move |app| {
            let handle = app.handle().clone();

            // Setup system tray
            tray::setup(&handle)?;

            // Start HTTP API server
            let api_state = app_state_for_api.clone();
            let api_handle = handle.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = api::serve(api_state, api_handle).await {
                    tracing::error!("API server error: {e}");
                }
            });

            // Initial content fetch
            let fetch_state = app_state_for_api.clone();
            tauri::async_runtime::spawn(async move {
                let config = fetch_state.config.lock().await;
                let config_clone = config.clone();
                drop(config);
                let mut cm = fetch_state.content_manager.lock().await;
                cm.update_config(config_clone);
                if let Err(e) = cm.refresh().await {
                    tracing::warn!("Initial content fetch failed: {e}");
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running streambreak");
}
