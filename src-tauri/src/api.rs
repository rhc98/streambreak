use crate::AppState;
use tauri::Manager;
use axum::{
    extract::{Query, State as AxumState},
    response::Json,
    routing::{get, post},
    Router,
};
use serde::Deserialize;
use std::sync::Arc;

#[derive(Deserialize)]
pub struct ReasonQuery {
    pub reason: Option<String>,
}

pub async fn serve(
    state: Arc<AppState>,
    app_handle: tauri::AppHandle,
) -> Result<(), Box<dyn std::error::Error>> {
    let shared = Arc::new((state, app_handle));

    let app = Router::new()
        .route("/api/timer/start", post(timer_start))
        .route("/api/show", post(show_popup))
        .route("/api/hide", post(hide_popup))
        .route("/api/status", get(status))
        .route("/api/content/next", get(content_next))
        .with_state(shared);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:19840").await?;
    tracing::info!("API server listening on http://127.0.0.1:19840");
    axum::serve(listener, app).await?;
    Ok(())
}

type SharedState = Arc<(Arc<AppState>, tauri::AppHandle)>;

async fn timer_start(AxumState(shared): AxumState<SharedState>) -> Json<serde_json::Value> {
    let mut timer = shared.0.timer.lock().await;
    let should_show = timer.check_threshold();
    if should_show {
        timer.show();
        drop(timer);
        if let Err(e) = crate::window::show_or_create(&shared.1) {
            tracing::error!("Failed to show popup: {e}");
        }
    } else {
        timer.start();
        drop(timer);
    }
    Json(serde_json::json!({ "ok": true }))
}

async fn show_popup(
    AxumState(shared): AxumState<SharedState>,
    Query(q): Query<ReasonQuery>,
) -> Json<serde_json::Value> {
    let mut timer = shared.0.timer.lock().await;
    timer.show();
    drop(timer);

    if let Err(e) = crate::window::show_or_create(&shared.1) {
        tracing::error!("Failed to show popup: {e}");
    }

    Json(serde_json::json!({
        "ok": true,
        "reason": q.reason,
    }))
}

async fn hide_popup(
    AxumState(shared): AxumState<SharedState>,
    Query(q): Query<ReasonQuery>,
) -> Json<serde_json::Value> {
    let mut timer = shared.0.timer.lock().await;
    timer.hide();
    drop(timer);

    let is_complete = q.reason.as_deref() == Some("complete");
    let handle = shared.1.clone();

    if is_complete {
        let config = shared.0.config.lock().await;
        let delay = config.general.fade_out_delay_ms;
        drop(config);

        tokio::spawn(async move {
            // If user is focused on the popup (e.g. playing a game), wait until they stop
            if let Some(win) = handle.get_webview_window("popup") {
                let max_wait = std::time::Duration::from_secs(600);
                let poll_interval = std::time::Duration::from_millis(500);
                let started = std::time::Instant::now();

                while started.elapsed() < max_wait {
                    match win.is_focused() {
                        Ok(true) => tokio::time::sleep(poll_interval).await,
                        _ => break,
                    }
                }
            }

            tokio::time::sleep(std::time::Duration::from_millis(delay)).await;
            let _ = crate::window::hide(&handle);
        });
    } else {
        let _ = crate::window::hide(&handle);
    }

    Json(serde_json::json!({ "ok": true }))
}

async fn status(AxumState(shared): AxumState<SharedState>) -> Json<serde_json::Value> {
    let timer = shared.0.timer.lock().await;
    let s = timer.status();
    Json(serde_json::json!({
        "elapsed_ms": s.elapsed_ms,
        "popup_visible": s.popup_visible,
        "mode": s.mode,
    }))
}

async fn content_next(AxumState(shared): AxumState<SharedState>) -> Json<serde_json::Value> {
    let mut cm = shared.0.content_manager.lock().await;
    match cm.next_item().await {
        Ok(Some(item)) => Json(serde_json::to_value(item).unwrap()),
        Ok(None) => Json(serde_json::json!({ "error": "no content" })),
        Err(e) => Json(serde_json::json!({ "error": e.to_string() })),
    }
}
