use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    #[serde(default = "default_general")]
    pub general: GeneralConfig,
    #[serde(default = "default_popup")]
    pub popup: PopupConfig,
    #[serde(default = "default_content")]
    pub content: ContentConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneralConfig {
    #[serde(default = "default_threshold")]
    pub threshold_seconds: u64,
    #[serde(default = "default_true")]
    pub auto_hide_on_complete: bool,
    #[serde(default = "default_fade_out")]
    pub fade_out_delay_ms: u64,
    #[serde(default = "default_language")]
    pub language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PopupConfig {
    #[serde(default = "default_width")]
    pub width: u32,
    #[serde(default = "default_height")]
    pub height: u32,
    #[serde(default = "default_position")]
    pub position: String,
    #[serde(default = "default_opacity")]
    pub opacity: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentConfig {
    #[serde(default = "default_rotation")]
    pub rotation_seconds: u64,
    #[serde(default = "default_types")]
    pub types: Vec<String>,
    #[serde(default)]
    pub news: NewsConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewsConfig {
    #[serde(default = "default_feeds_en")]
    pub feeds_en: Vec<FeedSource>,
    #[serde(default = "default_feeds_ko")]
    pub feeds_ko: Vec<FeedSource>,
    #[serde(default = "default_max_items")]
    pub max_items: usize,
    #[serde(default = "default_cache_ttl")]
    pub cache_ttl_minutes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeedSource {
    pub name: String,
    pub url: String,
    pub icon: String,
}

// Default value functions
fn default_general() -> GeneralConfig {
    GeneralConfig {
        threshold_seconds: 30,
        auto_hide_on_complete: true,
        fade_out_delay_ms: 3000,
        language: "en".into(),
    }
}

fn default_popup() -> PopupConfig {
    PopupConfig {
        width: 400,
        height: 500,
        position: "bottom-right".into(),
        opacity: 0.95,
    }
}

fn default_content() -> ContentConfig {
    ContentConfig {
        rotation_seconds: 15,
        types: vec!["news".into(), "games".into()],
        news: NewsConfig::default(),
    }
}

impl Default for NewsConfig {
    fn default() -> Self {
        Self {
            feeds_en: default_feeds_en(),
            feeds_ko: default_feeds_ko(),
            max_items: 10,
            cache_ttl_minutes: 30,
        }
    }
}

fn default_feeds_en() -> Vec<FeedSource> {
    vec![
        FeedSource {
            name: "Hacker News".into(),
            url: "https://hnrss.org/frontpage".into(),
            icon: "\u{1f525}".into(), // 🔥
        },
        FeedSource {
            name: "TechCrunch".into(),
            url: "https://techcrunch.com/feed/".into(),
            icon: "\u{1f4a1}".into(), // 💡
        },
    ]
}

fn default_feeds_ko() -> Vec<FeedSource> {
    vec![FeedSource {
        name: "GeekNews".into(),
        url: "https://news.hada.io/rss/news".into(),
        icon: "\u{1f4f0}".into(), // 📰
    }]
}

fn default_threshold() -> u64 { 30 }
fn default_true() -> bool { true }
fn default_fade_out() -> u64 { 3000 }
fn default_language() -> String { "en".into() }
fn default_width() -> u32 { 400 }
fn default_height() -> u32 { 500 }
fn default_position() -> String { "bottom-right".into() }
fn default_opacity() -> f64 { 0.95 }
fn default_rotation() -> u64 { 15 }
fn default_types() -> Vec<String> { vec!["news".into(), "games".into()] }
fn default_max_items() -> usize { 10 }
fn default_cache_ttl() -> u64 { 30 }

impl Config {
    pub fn path() -> PathBuf {
        let dir = dirs::home_dir()
            .expect("No home directory")
            .join(".streambreak");
        dir.join("config.toml")
    }

    pub fn load() -> Self {
        let path = Self::path();
        if path.exists() {
            let content = std::fs::read_to_string(&path).unwrap_or_default();
            toml::from_str(&content).unwrap_or_else(|e| {
                tracing::warn!("Failed to parse config: {e}, using defaults");
                Self::default()
            })
        } else {
            Self::default()
        }
    }

    pub fn save(&self) -> std::io::Result<()> {
        let path = Self::path();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let content = toml::to_string_pretty(self).unwrap();
        std::fs::write(&path, content)?;
        Ok(())
    }

    pub fn save_default() -> std::io::Result<PathBuf> {
        let path = Self::path();
        let config = Self::default();
        config.save()?;
        Ok(path)
    }
}

impl Default for Config {
    fn default() -> Self {
        Self {
            general: default_general(),
            popup: default_popup(),
            content: default_content(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let c = Config::default();
        assert_eq!(c.general.threshold_seconds, 30);
        assert_eq!(c.general.language, "en");
        assert_eq!(c.popup.width, 400);
        assert_eq!(c.popup.height, 500);
        assert_eq!(c.content.rotation_seconds, 15);
        assert_eq!(c.content.news.max_items, 10);
        assert_eq!(c.content.news.feeds_en.len(), 2);
        assert_eq!(c.content.news.feeds_en[0].name, "Hacker News");
        assert_eq!(c.content.news.feeds_en[1].name, "TechCrunch");
        assert_eq!(c.content.news.feeds_ko.len(), 1);
        assert_eq!(c.content.news.feeds_ko[0].name, "GeekNews");
    }

    #[test]
    fn test_config_serde_roundtrip() {
        let original = Config::default();
        let serialized = toml::to_string(&original).expect("serialize failed");
        let deserialized: Config = toml::from_str(&serialized).expect("deserialize failed");
        assert_eq!(deserialized.general.threshold_seconds, original.general.threshold_seconds);
        assert_eq!(deserialized.general.language, original.general.language);
        assert_eq!(deserialized.popup.width, original.popup.width);
        assert_eq!(deserialized.popup.height, original.popup.height);
        assert_eq!(deserialized.content.rotation_seconds, original.content.rotation_seconds);
        assert_eq!(deserialized.content.news.max_items, original.content.news.max_items);
        assert_eq!(deserialized.content.news.feeds_en.len(), original.content.news.feeds_en.len());
        assert_eq!(deserialized.content.news.feeds_ko.len(), original.content.news.feeds_ko.len());
    }
}
