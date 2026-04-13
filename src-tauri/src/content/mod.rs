pub mod cache;
pub mod rotation;
pub mod rss;

use crate::config::Config;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentItem {
    pub title: String,
    pub url: String,
    pub source: String,
    pub icon: String,
    pub published_at: String,
}

pub struct ContentManager {
    config: Option<Config>,
    items: Vec<ContentItem>,
    cursor: usize,
}

impl ContentManager {
    pub fn new_default() -> Self {
        Self {
            config: None,
            items: Vec::new(),
            cursor: 0,
        }
    }

    pub fn update_config(&mut self, config: Config) {
        self.config = Some(config);
    }

    pub async fn refresh(&mut self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let config = self.config.as_ref().ok_or("Config not set")?;
        let feeds = if config.general.language == "ko" {
            &config.content.news.feeds_ko
        } else {
            &config.content.news.feeds_en
        };

        let mut all_items = Vec::new();
        for feed in feeds {
            match rss::fetch_feed(&feed.url, &feed.name, &feed.icon).await {
                Ok(mut items) => all_items.append(&mut items),
                Err(e) => tracing::warn!("Failed to fetch {}: {e}", feed.name),
            }
        }

        // Sort by published date descending
        all_items.sort_by(|a, b| b.published_at.cmp(&a.published_at));

        // Limit to max_items
        let max = config.content.news.max_items;
        all_items.truncate(max);

        self.items = all_items;
        self.cursor = 0;
        Ok(())
    }

    pub async fn get_items(&mut self) -> Result<Vec<ContentItem>, Box<dyn std::error::Error + Send + Sync>> {
        if self.items.is_empty() {
            self.refresh().await?;
        }
        Ok(self.items.clone())
    }

    pub async fn next_item(&mut self) -> Result<Option<ContentItem>, Box<dyn std::error::Error + Send + Sync>> {
        if self.items.is_empty() {
            self.refresh().await?;
        }
        if self.items.is_empty() {
            return Ok(None);
        }
        let item = self.items[self.cursor].clone();
        self.cursor = (self.cursor + 1) % self.items.len();
        Ok(Some(item))
    }
}

#[cfg(test)]
impl ContentManager {
    fn is_empty(&self) -> bool {
        self.items.is_empty()
    }

    fn cursor(&self) -> usize {
        self.cursor
    }

    fn set_items(&mut self, items: Vec<ContentItem>) {
        self.items = items;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_item(title: &str) -> ContentItem {
        ContentItem {
            title: title.to_string(),
            url: format!("https://example.com/{title}"),
            source: "test".to_string(),
            icon: String::new(),
            published_at: String::new(),
        }
    }

    #[test]
    fn test_new_default_empty() {
        let mgr = ContentManager::new_default();
        assert!(mgr.is_empty());
        assert_eq!(mgr.cursor(), 0);
    }

    #[tokio::test]
    async fn test_cursor_rotation() {
        let mut mgr = ContentManager::new_default();
        mgr.set_items(vec![make_item("a"), make_item("b"), make_item("c")]);

        let r0 = mgr.next_item().await.unwrap().unwrap();
        let r1 = mgr.next_item().await.unwrap().unwrap();
        let r2 = mgr.next_item().await.unwrap().unwrap();
        let r3 = mgr.next_item().await.unwrap().unwrap();

        assert_eq!(r0.title, "a");
        assert_eq!(r1.title, "b");
        assert_eq!(r2.title, "c");
        assert_eq!(r3.title, "a");
    }
}
