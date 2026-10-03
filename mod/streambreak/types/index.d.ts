// streambreak's $.state contract. Persistent data (feed cache, language override) lives in $.store.

/**
 * idle: no main turn running · working: a main turn is running · suggested: still running and the
 * break toast was already offered · done: the turn finished and the pane shows the banner
 */
export type Phase = 'idle' | 'working' | 'suggested' | 'done'

export type Tab = 'news' | 'games'

export type GameKind = 'memory' | 'gomoku' | 'minesweeper'

/** One Memory Match card; `symbol` indexes the 8 pair symbols. */
export type MemoryCard = { symbol: number; isFaceUp: boolean; isMatched: boolean }

/**
 * A Memory Match game. `mismatch` is the face-up pair waiting to turn back: it lives in state, not
 * only in a timer, so a reload or a closed pane can settle it instead of leaving it stuck (S9).
 */
export type MemoryState = {
  cards: MemoryCard[]
  mismatch: [number, number] | null
  moves: number
  /** ms since epoch of the first flip; null before it. */
  startedAt: number | null
  /** ms since epoch of the last match; null while playing. */
  finishedAt: number | null
}

/** 0 empty · 1 black (the person) · 2 white (the AI). */
export type Stone = 0 | 1 | 2

export type GomokuState = {
  board: Stone[][]
  result: null | 'black' | 'white' | 'draw'
  lastMove: [number, number] | null
}

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
      /** The game the games tab shows; null until the tab is first opened (then a random one). */
      game: GameKind | null
      /** Each game's board survives tab switches, pane closes, reloads and /clear (S1, S10). */
      memory: MemoryState | null
      gomoku: GomokuState | null
    }
  }
}
