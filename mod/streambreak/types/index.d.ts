// streambreak's $.state contract. Persistent data (feed cache, language override) lives in $.store.

/**
 * idle: no main turn running · working: a main turn is running · suggested: still running and the
 * break toast was already offered · done: the turn finished and the pane shows the banner
 */
export type Phase = 'idle' | 'working' | 'suggested' | 'done'

export type Tab = 'news' | 'games'

export type GameKind = 'memory' | 'gomoku' | 'minesweeper'

/** One headline, the Tauri app's ContentItem shape. `published_at` is ISO 8601, or "" undated. */
export type NewsItem = {
  title: string
  url: string
  source: string
  icon: string
  published_at: string
}

/** What the news tab draws: items newest first, and whether they came from a stale cache. */
export type NewsFeed = { items: NewsItem[]; isOffline: boolean; isLoading: boolean }

declare module 'claude-code' {
  interface PluginState {
    streambreak: {
      phase: Phase
      /** The running main-loop turn; subagent turns never land here. */
      turnId: string | null
      /** When that turn started (ms since epoch), so a reload can re-arm the break timer. */
      turnStartedAt: number | null
      tab: Tab
      news: NewsFeed
      /** The first visible card; advances every rotation tick. */
      newsIndex: number
      game: GameKind | null
    }
  }
}
