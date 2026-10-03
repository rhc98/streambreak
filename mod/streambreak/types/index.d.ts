// streambreak's $.state contract. Persistent data (feed cache, language override) lives in $.store.

/**
 * idle: no main turn running · working: a main turn is running · suggested: still running and the
 * break toast was already offered · done: the turn finished and the pane shows the banner
 */
export type Phase = 'idle' | 'working' | 'suggested' | 'done'

export type Tab = 'news' | 'games'

export type GameKind = 'memory' | 'gomoku' | 'minesweeper'

declare module 'claude-code' {
  interface PluginState {
    streambreak: {
      phase: Phase
      /** The running main-loop turn; subagent turns never land here. */
      turnId: string | null
      /** When that turn started (ms since epoch), so a reload can re-arm the break timer. */
      turnStartedAt: number | null
      tab: Tab
      newsIndex: number
      game: GameKind | null
    }
  }
}
