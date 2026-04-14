use std::path::PathBuf;

pub async fn run_init() {
    // 1. Create config
    match crate::config::Config::save_default() {
        Ok(path) => println!("Config created: {}", path.display()),
        Err(e) => {
            eprintln!("Failed to create config: {e}");
            return;
        }
    }

    // 2. Register Claude Code hooks
    match register_hooks() {
        Ok(_) => println!("Claude Code hooks registered successfully"),
        Err(e) => eprintln!("Failed to register hooks: {e}"),
    }

    println!("\nstreambreak initialized! Run `streambreak` to start the daemon.");
}

fn register_hooks() -> Result<(), Box<dyn std::error::Error>> {
    let settings_path = claude_settings_path();
    let mut settings: serde_json::Value = if settings_path.exists() {
        let content = std::fs::read_to_string(&settings_path)?;
        serde_json::from_str(&content)?
    } else {
        serde_json::json!({})
    };

    let streambreak_hooks = vec![
        ("PreToolUse", serde_json::json!({
            "matcher": "",
            "hooks": [{
                "type": "command",
                "command": "streambreak timer start",
                "timeout": 3
            }]
        })),
        ("Notification", serde_json::json!({
            "matcher": "idle_prompt|permission_prompt",
            "hooks": [{
                "type": "command",
                "command": "streambreak show --reason=idle",
                "timeout": 3
            }]
        })),
        ("Stop", serde_json::json!({
            "matcher": "",
            "hooks": [{
                "type": "command",
                "command": "streambreak hide --reason=complete",
                "timeout": 3
            }]
        })),
    ];

    if settings.get("hooks").is_none() {
        settings["hooks"] = serde_json::json!({});
    }
    let hooks_obj = settings["hooks"].as_object_mut().unwrap();

    for (event, hook_entry) in streambreak_hooks {
        // Remove any existing streambreak hooks for this event
        if let Some(arr) = hooks_obj.get_mut(event).and_then(|v| v.as_array_mut()) {
            arr.retain(|entry| {
                !entry["hooks"]
                    .as_array()
                    .map(|h| h.iter().any(|cmd| {
                        cmd["command"].as_str().map_or(false, |c| c.starts_with("streambreak"))
                    }))
                    .unwrap_or(false)
            });
            arr.push(hook_entry);
        } else {
            hooks_obj.insert(event.to_string(), serde_json::json!([hook_entry]));
        }
    }

    if let Some(parent) = settings_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&settings_path, serde_json::to_string_pretty(&settings)?)?;

    println!("Hooks written to: {}", settings_path.display());
    Ok(())
}

fn claude_settings_path() -> PathBuf {
    dirs::home_dir()
        .expect("No home directory")
        .join(".claude")
        .join("settings.json")
}
