// streambreak's $.state contract. Persistent data (feed cache, language override) lives in $.store.

/** idle: no main turn running · working: a main turn is running · done: the turn finished, banner shown */
export type Phase = 'idle' | 'working' | 'done'

export type Tab = 'news' | 'games'

export type GameKind = 'memory' | 'gomoku' | 'minesweeper'

declare module 'claude-code' {
  interface PluginState {
    streambreak: {
      phase: Phase
      /** The running main-loop turn; subagent turns never land here. */
      turnId: string | null
      tab: Tab
      newsIndex: number
      game: GameKind | null
    }
  }
}
