// Minesweeper 8×8 / 10 mines, ported from src/games/Minesweeper.tsx: mines are laid on the first
// open, never in the 3×3 around it; a blank cell opens its neighbours (flood fill). A Button has
// one press, so flagging is a mode the person toggles instead of a right click.
import type { MineCell, MinesState } from '../../types'
import type { Random } from './memory'

export const ROWS = 8
export const COLS = 8
export const MINES = 10

const NEIGHBOURS = [-1, 0, 1]
  .flatMap(dr => [-1, 0, 1].map(dc => [dr, dc] as const))
  .filter(([dr, dc]) => dr !== 0 || dc !== 0)
const inside = (r: number, c: number) => r >= 0 && r < ROWS && c >= 0 && c < COLS

const emptyBoard = (): MineCell[][] =>
  Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({
      isMine: false,
      isRevealed: false,
      isFlagged: false,
      adjacent: 0,
    })),
  )

export const newMines = (): MinesState => ({
  board: emptyBoard(),
  status: 'playing',
  isLaid: false,
  mode: 'open',
})

/**
 * Lays MINES mines away from (r, c) and its neighbours, then counts every cell's neighbours.
 * A partial Fisher–Yates over the free cells: exactly MINES draws for any `random`, each index
 * clamped, so a stub that repeats or returns 1 can neither loop nor reach the safe zone.
 * Flags placed before the first open are kept (the original dropped them but kept counting them).
 */
export const layMines = (board: MineCell[][], r: number, c: number, random: Random) => {
  const free = board
    .flatMap((row, rr) => row.map((_, cc) => `${rr}:${cc}`))
    .filter((_, i) => Math.abs(Math.floor(i / COLS) - r) > 1 || Math.abs((i % COLS) - c) > 1)
  const count = Math.min(MINES, free.length)
  for (let i = 0; i < count; i += 1) {
    const j = Math.min(free.length - 1, i + Math.floor(random() * (free.length - i)))
    ;[free[i], free[j]] = [free[j] as string, free[i] as string]
  }
  const mines = new Set(free.slice(0, count))
  const isMine = (rr: number, cc: number) => mines.has(`${rr}:${cc}`)

  return board.map((row, rr) =>
    row.map((cell, cc) => ({
      ...cell,
      isMine: isMine(rr, cc),
      adjacent: NEIGHBOURS.filter(
        ([dr, dc]) => inside(rr + dr, cc + dc) && isMine(rr + dr, cc + dc),
      ).length,
    })),
  )
}

/** Opens (r, c); a cell with no mine around it opens its neighbours too. Flags stay shut. */
export const reveal = (board: MineCell[][], r: number, c: number) => {
  const next = board.map(row => row.map(cell => ({ ...cell })))
  const stack: [number, number][] = [[r, c]]
  while (stack.length > 0) {
    const [cr, cc] = stack.pop() as [number, number]
    const cell = next[cr]?.[cc]
    if (!cell || cell.isRevealed || cell.isFlagged) continue
    cell.isRevealed = true
    if (cell.adjacent !== 0 || cell.isMine) continue
    for (const [dr, dc] of NEIGHBOURS) {
      if (inside(cr + dr, cc + dc) && !next[cr + dr]?.[cc + dc]?.isRevealed) {
        stack.push([cr + dr, cc + dc])
      }
    }
  }
  return next
}

export const isCleared = (board: MineCell[][]) =>
  board.every(row => row.every(cell => cell.isMine || cell.isRevealed))

export const flagsPlaced = (state: MinesState) =>
  state.board.flat().filter(cell => cell.isFlagged).length

export const toggleMode = (state: MinesState): MinesState =>
  state.status === 'playing' ? { ...state, mode: state.mode === 'open' ? 'flag' : 'open' } : state

/** The person presses (r, c) in the current mode. Returns the same object when nothing changes. */
export const press = (
  state: MinesState,
  r: number,
  c: number,
  random: Random = Math.random,
): MinesState => {
  const cell = state.board[r]?.[c]
  if (!cell || state.status !== 'playing' || cell.isRevealed) return state

  if (state.mode === 'flag') {
    const board = state.board.map((row, rr) =>
      row.map((one, cc) => (rr === r && cc === c ? { ...one, isFlagged: !one.isFlagged } : one)),
    )
    return { ...state, board }
  }
  if (cell.isFlagged) return state

  const laid = state.isLaid ? state.board : layMines(state.board, r, c, random)
  if (laid[r]?.[c]?.isMine) {
    const board = laid.map(row => row.map(one => (one.isMine ? { ...one, isRevealed: true } : one)))
    return { ...state, board, isLaid: true, status: 'lost' }
  }
  const board = reveal(laid, r, c)

  return { ...state, board, isLaid: true, status: isCleared(board) ? 'won' : 'playing' }
}
