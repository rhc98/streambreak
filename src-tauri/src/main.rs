use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "streambreak", about = "Break time content during AI coding waits")]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    /// Initialize config and register Claude Code hooks
    Init,
    /// Show the popup window
    Show {
        #[arg(long)]
        reason: Option<String>,
    },
    /// Hide the popup window
    Hide {
        #[arg(long)]
        reason: Option<String>,
    },
    /// Timer operations
    Timer {
        #[command(subcommand)]
        action: TimerAction,
    },
    /// Configuration management
    Config {
        #[command(subcommand)]
        action: ConfigAction,
    },
}

#[derive(Subcommand)]
enum TimerAction {
    /// Start the idle timer
    Start,
    /// Show timer status
    Status,
}

#[derive(Subcommand)]
enum ConfigAction {
    /// Show current configuration
    Show,
    /// Open config in editor
    Edit,
}

fn main() {
    let cli = Cli::parse();

    match cli.command {
        Some(cmd) => run_cli(cmd),
        None => run_app(),
    }
}

fn run_cli(cmd: Commands) {
    let rt = tokio::runtime::Runtime::new().expect("Failed to create runtime");
    rt.block_on(async {
        let client = reqwest::Client::new();
        let base = "http://127.0.0.1:19840";

        match cmd {
            Commands::Init => {
                streambreak_lib::cli::init::run_init().await;
            }
            Commands::Show { reason } => {
                let url = match reason {
                    Some(r) => format!("{base}/api/show?reason={r}"),
                    None => format!("{base}/api/show"),
                };
                match client.post(&url).send().await {
                    Ok(_) => println!("Popup shown"),
                    Err(e) => eprintln!("Failed to connect to daemon: {e}"),
                }
            }
            Commands::Hide { reason } => {
                let url = match reason {
                    Some(r) => format!("{base}/api/hide?reason={r}"),
                    None => format!("{base}/api/hide"),
                };
                match client.post(&url).send().await {
                    Ok(_) => println!("Popup hidden"),
                    Err(e) => eprintln!("Failed to connect to daemon: {e}"),
                }
            }
            Commands::Timer { action } => match action {
                TimerAction::Start => {
                    match client.post(format!("{base}/api/timer/start")).send().await {
                        Ok(_) => {}
                        Err(e) => eprintln!("Failed to connect to daemon: {e}"),
                    }
                }
                TimerAction::Status => {
                    match client.get(format!("{base}/api/status")).send().await {
                        Ok(resp) => {
                            if let Ok(text) = resp.text().await {
                                println!("{text}");
                            }
                        }
                        Err(e) => eprintln!("Failed to connect to daemon: {e}"),
                    }
                }
            },
            Commands::Config { action } => match action {
                ConfigAction::Show => {
                    let config = streambreak_lib::config::Config::load();
                    println!("{}", toml::to_string_pretty(&config).unwrap());
                }
                ConfigAction::Edit => {
                    let path = streambreak_lib::config::Config::path();
                    let editor = std::env::var("EDITOR").unwrap_or_else(|_| "vim".into());
                    std::process::Command::new(editor)
                        .arg(&path)
                        .status()
                        .expect("Failed to open editor");
                }
            },
        }
    });
}

fn run_app() {
    streambreak_lib::run();
}
