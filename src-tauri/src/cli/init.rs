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

    let hooks = serde_json::json!({
        "PreToolUse": [{
            "matcher": "",
            "hooks": [{
                "type": "command",
                "command": "streambreak timer start",
                "timeout": 3
            }]
        }],
        "Notification": [{
            "matcher": "idle_prompt|permission_prompt",
            "hooks": [{
                "type": "command",
                "command": "streambreak show --reason=idle",
                "timeout": 3
            }]
        }],
        "Stop": [{
            "matcher": "",
            "hooks": [{
                "type": "command",
                "command": "streambreak hide --reason=complete",
                "timeout": 3
            }]
        }]
    });

    settings["hooks"] = hooks;

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
