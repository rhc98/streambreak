// Memory Match, ported from src/games/MemoryMatch.tsx: 8 pairs, 16 cards, a mismatched pair
// turns back after FLIP_BACK_MS. Pure: state in, state out; the caller owns timers and $.state.
import type { MemoryState } from '../../types'

// One emoji per Tauri icon (Code, Terminal, Bug, Cpu, Database, Globe, Zap, Lock), each a single
// wide code point so every terminal gives the cards the same width.
export const SYMBOLS = ['💻', '📟', '🐛', '🧠', '💾', '🌐', '⚡', '🔒'] as const
export const FLIP_BACK_MS = 600

export type Random = () => number

const shuffle = <T>(items: readonly T[], random: Random) => {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j] as T, copy[i] as T]
  }
  return copy
}

export const newMemory = (random: Random = Math.random): MemoryState => ({
  cards: shuffle(
    SYMBOLS.flatMap((_, symbol) => [symbol, symbol]),
    random,
  ).map(symbol => ({ symbol, isFaceUp: false, isMatched: false })),
  mismatch: null,
  moves: 0,
  startedAt: null,
  finishedAt: null,
})

/** Turns a shown mismatched pair face down again (the timer's job, or the next press's). */
export const settleMismatch = (state: MemoryState): MemoryState => {
  if (!state.mismatch) return state
  const [a, b] = state.mismatch

  return {
    ...state,
    cards: state.cards.map((card, i) => (i === a || i === b ? { ...card, isFaceUp: false } : card)),
    mismatch: null,
  }
}

/**
 * The person turns card `index` at time `now`. A pending mismatch settles first, so a quick
 * press never waits on the timer. Returns the same object when the press does nothing.
 */
export const flip = (current: MemoryState, index: number, now: number): MemoryState => {
  const state = settleMismatch(current)
  const card = state.cards[index]
  if (!card || card.isFaceUp || card.isMatched || state.finishedAt !== null) return current

  const cards = state.cards.map((one, i) => (i === index ? { ...one, isFaceUp: true } : one))
  const startedAt = state.startedAt ?? now
  const open = cards.flatMap((one, i) => (one.isFaceUp && !one.isMatched ? [i] : []))
  if (open.length < 2) return { ...state, cards, startedAt }

  const [a, b] = open as [number, number]
  const moves = state.moves + 1
  if (cards[a]?.symbol !== cards[b]?.symbol)
    return { ...state, cards, startedAt, moves, mismatch: [a, b] }

  const matched = cards.map((one, i) => (i === a || i === b ? { ...one, isMatched: true } : one))
  const isDone = matched.every(one => one.isMatched)

  return { ...state, cards: matched, startedAt, moves, finishedAt: isDone ? now : null }
}

/** Whole seconds played: from the first flip to the last match, or to `now` while playing. */
export const elapsedSeconds = (state: MemoryState, now: number) =>
  state.startedAt === null ? 0 : Math.floor(((state.finishedAt ?? now) - state.startedAt) / 1000)
