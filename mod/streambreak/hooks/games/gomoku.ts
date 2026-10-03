// Gomoku 9×9, five in a row, against the heuristic AI of src/games/Gomoku.tsx (same scoring, same
// candidate filter). Pure: the board is plain data so it lives in $.state as is.
import type { GomokuState, Stone } from '../../types'
import type { Random } from './memory'

export const SIZE = 9
export const WIN = 5

export type Board = Stone[][]

const DIRECTIONS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
] as const

const at = (board: Board, r: number, c: number): Stone | undefined => board[r]?.[c]
const inside = (r: number, c: number) => r >= 0 && r < SIZE && c >= 0 && c < SIZE

export const createBoard = (): Board =>
  Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => 0 as Stone))

export const checkWin = (board: Board, r: number, c: number, player: Stone) =>
  DIRECTIONS.some(([dr, dc]) => {
    let count = 1
    for (const sign of [1, -1]) {
      for (let d = 1; d < WIN; d += 1) {
        const nr = r + dr * d * sign
        const nc = c + dc * d * sign
        if (!inside(nr, nc) || at(board, nr, nc) !== player) break
        count += 1
      }
    }
    return count >= WIN
  })

export const isFull = (board: Board) => board.every(row => row.every(stone => stone !== 0))

export const evaluateLine = (
  board: Board,
  r: number,
  c: number,
  dr: number,
  dc: number,
  player: Stone,
) => {
  const opponent = player === 1 ? 2 : 1
  let count = 0
  let openEnds = 0
  const isBlocked = [false, false]

  for (const [side, sign] of [
    [0, 1],
    [1, -1],
  ] as const) {
    for (let d = 1; d <= 4; d += 1) {
      const nr = r + dr * d * sign
      const nc = c + dc * d * sign
      if (!inside(nr, nc) || at(board, nr, nc) === opponent) {
        isBlocked[side] = true
        break
      }
      if (at(board, nr, nc) === player) {
        count += 1
      } else {
        openEnds += 1
        break
      }
    }
  }

  if (isBlocked[0] && isBlocked[1] && count < 4) return 0
  if (count >= 4) return 100000
  if (count === 3 && openEnds === 2) return 10000
  if (count === 3 && openEnds === 1) return 1000
  if (count === 2 && openEnds === 2) return 500
  if (count === 2 && openEnds === 1) return 100
  if (count === 1 && openEnds === 2) return 50
  if (count === 1 && openEnds === 1) return 10
  return 0
}

export const scorePosition = (board: Board, r: number, c: number, player: Stone) => {
  const lines = DIRECTIONS.reduce(
    (total, [dr, dc]) => total + evaluateLine(board, r, c, dr, dc, player),
    0,
  )
  const center = Math.floor(SIZE / 2)
  const centerDistance = Math.abs(r - center) + Math.abs(c - center)

  return lines + Math.max(0, (SIZE - centerDistance) * 2)
}

/** The AI's (white, 2) move: best attack ×1.1 + defence among cells near a stone; ties random. */
export const aiMove = (board: Board, random: Random = Math.random): [number, number] | null => {
  const stones = board.flat().filter(stone => stone !== 0).length
  let bestScore = -1
  let bestMoves: [number, number][] = []

  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (at(board, r, c) !== 0) continue
      let isNear = false
      for (let dr = -2; dr <= 2 && !isNear; dr += 1) {
        for (let dc = -2; dc <= 2 && !isNear; dc += 1) {
          isNear = inside(r + dr, c + dc) && at(board, r + dr, c + dc) !== 0
        }
      }
      if (!isNear && stones > 0) continue

      const score = scorePosition(board, r, c, 2) * 1.1 + scorePosition(board, r, c, 1)
      if (score > bestScore) {
        bestScore = score
        bestMoves = [[r, c]]
      } else if (score === bestScore) {
        bestMoves.push([r, c])
      }
    }
  }

  return bestMoves[Math.floor(random() * bestMoves.length)] ?? null
}

export const newGomoku = (): GomokuState => ({ board: createBoard(), result: null, lastMove: null })

const place = (board: Board, r: number, c: number, stone: Stone) =>
  board.map((row, i) => (i === r ? row.map((cell, j) => (j === c ? stone : cell)) : row))

/**
 * The person (black, 1) plays (r, c) and the AI answers in the same step: one state write, so no
 * half-played turn can be left behind by a reload. Returns the same object for an illegal move.
 */
export const playTurn = (
  state: GomokuState,
  r: number,
  c: number,
  random: Random = Math.random,
): GomokuState => {
  if (state.result !== null || at(state.board, r, c) !== 0) return state

  const afterPlayer = place(state.board, r, c, 1)
  if (checkWin(afterPlayer, r, c, 1))
    return { board: afterPlayer, result: 'black', lastMove: [r, c] }
  if (isFull(afterPlayer)) return { board: afterPlayer, result: 'draw', lastMove: [r, c] }

  const reply = aiMove(afterPlayer, random)
  if (!reply) return { board: afterPlayer, result: 'draw', lastMove: [r, c] }
  const [ar, ac] = reply
  const afterAi = place(afterPlayer, ar, ac, 2)
  const result = checkWin(afterAi, ar, ac, 2) ? 'white' : isFull(afterAi) ? 'draw' : null

  return { board: afterAi, result, lastMove: [ar, ac] }
}
