use super::ContentItem;

pub async fn fetch_feed(
    url: &str,
    source_name: &str,
    icon: &str,
) -> Result<Vec<ContentItem>, Box<dyn std::error::Error + Send + Sync>> {
    let client = reqwest::Client::builder()
        .user_agent("streambreak/0.1")
        .timeout(std::time::Duration::from_secs(10))
        .build()?;
    let body = client.get(url).send().await?.bytes().await?;
    if body.is_empty() {
        return Err("Empty response from feed".into());
    }
    let feed = feed_rs::parser::parse(&body[..])?;

    let items: Vec<ContentItem> = feed
        .entries
        .into_iter()
        .map(|entry| {
            let title = entry
                .title
                .map(|t| t.content)
                .unwrap_or_else(|| "Untitled".into());

            let url = entry
                .links
                .first()
                .map(|l| l.href.clone())
                .unwrap_or_default();

            let published_at = entry
                .published
                .or(entry.updated)
                .map(|d| d.to_rfc3339())
                .unwrap_or_default();

            ContentItem {
                title,
                url,
                source: source_name.to_string(),
                icon: icon.to_string(),
                published_at,
            }
        })
        .collect();

    Ok(items)
}
