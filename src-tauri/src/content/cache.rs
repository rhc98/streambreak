use super::ContentItem;
use rusqlite::{params, Connection};
use std::path::PathBuf;

pub struct Cache {
    conn: Connection,
}

impl Cache {
    pub fn open() -> Result<Self, rusqlite::Error> {
        let path = Self::db_path();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).ok();
        }
        let conn = Connection::open(&path)?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source TEXT NOT NULL,
                title TEXT NOT NULL,
                url TEXT NOT NULL UNIQUE,
                icon TEXT NOT NULL DEFAULT '',
                published_at TEXT NOT NULL DEFAULT '',
                fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
                read INTEGER NOT NULL DEFAULT 0
            );",
        )?;
        Ok(Self { conn })
    }

    fn db_path() -> PathBuf {
        dirs::home_dir()
            .expect("No home directory")
            .join(".streambreak")
            .join("cache.db")
    }

    pub fn upsert(&self, item: &ContentItem) -> Result<(), rusqlite::Error> {
        self.conn.execute(
            "INSERT OR IGNORE INTO items (source, title, url, icon, published_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![item.source, item.title, item.url, item.icon, item.published_at],
        )?;
        Ok(())
    }

    pub fn get_unread(&self, limit: usize) -> Result<Vec<ContentItem>, rusqlite::Error> {
        let mut stmt = self.conn.prepare(
            "SELECT title, url, source, icon, published_at FROM items WHERE read = 0 ORDER BY fetched_at DESC LIMIT ?1",
        )?;
        let items = stmt
            .query_map(params![limit as i64], |row| {
                Ok(ContentItem {
                    title: row.get(0)?,
                    url: row.get(1)?,
                    source: row.get(2)?,
                    icon: row.get(3)?,
                    published_at: row.get(4)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(items)
    }

    pub fn cleanup_old(&self, ttl_minutes: u64) -> Result<(), rusqlite::Error> {
        self.conn.execute(
            "DELETE FROM items WHERE fetched_at < datetime('now', ?1)",
            params![format!("-{ttl_minutes} minutes")],
        )?;
        Ok(())
    }

    #[cfg(test)]
    pub fn open_in_memory() -> Result<Self, rusqlite::Error> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source TEXT NOT NULL,
                title TEXT NOT NULL,
                url TEXT NOT NULL UNIQUE,
                icon TEXT NOT NULL DEFAULT '',
                published_at TEXT NOT NULL DEFAULT '',
                fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
                read INTEGER NOT NULL DEFAULT 0
            );",
        )?;
        Ok(Self { conn })
    }
}

#[cfg(test)]
mod tests {
    use super::ContentItem;
    use super::Cache;

    fn item(title: &str, url: &str) -> ContentItem {
        ContentItem {
            title: title.to_string(),
            url: url.to_string(),
            source: "src".to_string(),
            icon: String::new(),
            published_at: String::new(),
        }
    }

    #[test]
    fn test_upsert_and_read() {
        let cache = Cache::open_in_memory().unwrap();
        cache.upsert(&item("Hello", "https://example.com/1")).unwrap();
        let results = cache.get_unread(10).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].title, "Hello");
        assert_eq!(results[0].url, "https://example.com/1");
    }

    #[test]
    fn test_duplicate_url_ignored() {
        let cache = Cache::open_in_memory().unwrap();
        cache.upsert(&item("First", "https://example.com/dup")).unwrap();
        cache.upsert(&item("Second", "https://example.com/dup")).unwrap();
        let results = cache.get_unread(10).unwrap();
        assert_eq!(results.len(), 1);
    }
}
