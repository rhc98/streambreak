use super::ContentItem;

pub struct Rotation {
    items: Vec<ContentItem>,
    index: usize,
}

impl Rotation {
    pub fn new(items: Vec<ContentItem>) -> Self {
        Self { items, index: 0 }
    }

    pub fn next(&mut self) -> Option<&ContentItem> {
        if self.items.is_empty() {
            return None;
        }
        let item = &self.items[self.index];
        self.index = (self.index + 1) % self.items.len();
        Some(item)
    }

    pub fn update_items(&mut self, items: Vec<ContentItem>) {
        self.items = items;
        self.index = 0;
    }

    pub fn len(&self) -> usize {
        self.items.len()
    }

    pub fn is_empty(&self) -> bool {
        self.items.is_empty()
    }
}
