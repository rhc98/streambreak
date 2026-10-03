import { expect, test } from 'claude-code/testing'

import {
  COLS,
  flagsPlaced,
  isCleared,
  layMines,
  MINES,
  newMines,
  press,
  ROWS,
  reveal,
  toggleMode,
} from '../hooks/games/minesweeper'
import type { MineCell, MinesState } from '../types'

const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let x = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296
}

// A laid board from a picture: `*` mine, anything else safe; counts filled in by layMines' rule.
const fromPicture = (rows: string[]): MinesState => {
  const mines = rows.map(row => [...row].map(ch => ch === '*'))
  const board: MineCell[][] = mines.map((row, r) =>
    row.map((isMine, c) => ({
      isMine,
      isRevealed: false,
      isFlagged: false,
      adjacent: [-1, 0, 1]
        .flatMap(dr =>
          [-1, 0, 1].map(dc => mines[r + dr]?.[c + dc] === true && !(dr === 0 && dc === 0)),
        )
        .filter(Boolean).length,
    })),
  )
  return { board, status: 'playing', isLaid: true, mode: 'open' }
}

const PICTURE = [
  '*.......',
  '........',
  '........',
  '........',
  '........',
  '........',
  '......**',
  '......*.',
]

test('V3 mines: the first open lays 10 mines, none in the 3×3 around it', () => {
  for (let seed = 1; seed <= 20; seed += 1) {
    const board = layMines(newMines().board, 3, 5, seeded(seed))
    const mines = board.flatMap((row, r) => row.flatMap((cell, c) => (cell.isMine ? [[r, c]] : [])))

    expect(mines).toHaveLength(MINES)
    expect(mines.every(([r, c]) => Math.abs((r ?? 0) - 3) > 1 || Math.abs((c ?? 0) - 5) > 1)).toBe(
      true,
    )
  }
})

test('V3 mines: counts are the mines around each cell', () => {
  const board = layMines(newMines().board, 0, 0, seeded(3))
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      let around = 0
      for (let dr = -1; dr <= 1; dr += 1)
        for (let dc = -1; dc <= 1; dc += 1)
          if ((dr || dc) && board[r + dr]?.[c + dc]?.isMine) around += 1
      expect(board[r]?.[c]?.adjacent).toBe(around)
    }
  }
})

test('V3 mines: flood fill opens the blank region and its numbered edge, nothing past it', () => {
  const state = fromPicture(PICTURE)
  const board = reveal(state.board, 3, 3)

  expect(board[3]?.[3]?.isRevealed).toBe(true)
  expect(board[0]?.[1]?.isRevealed).toBe(true) // a numbered edge cell
  expect(board[0]?.[0]?.isRevealed).toBe(false) // the mine behind it
  expect(board[7]?.[7]?.isRevealed).toBe(false) // walled in by mines
  expect(board.flat().some(cell => cell.isMine && cell.isRevealed)).toBe(false)
})

test('V3 mines: opening every safe cell wins; opening a mine loses and shows them all', () => {
  const state = fromPicture(PICTURE)
  const almost = press(state, 3, 3)
  expect(almost.status).toBe('playing')
  const won = press(almost, 7, 7)
  expect(won.status).toBe('won')
  expect(isCleared(won.board)).toBe(true)

  const lost = press(state, 0, 0)
  expect(lost.status).toBe('lost')
  expect(lost.board.flat().filter(cell => cell.isMine && cell.isRevealed)).toHaveLength(4)
  expect(press(lost, 3, 3)).toBe(lost)
})

test('F10: flag mode toggles flags; a flagged cell cannot be opened', () => {
  const flagging = toggleMode(fromPicture(PICTURE))
  const flagged = press(flagging, 0, 0)

  expect(flagged.board[0]?.[0]?.isFlagged).toBe(true)
  expect(flagsPlaced(flagged)).toBe(1)
  const opening = toggleMode(flagged)
  expect(press(opening, 0, 0)).toBe(opening)
  expect(press(toggleMode(opening), 0, 0).board[0]?.[0]?.isFlagged).toBe(false)
})

test('F10: flags block the flood fill; revealed cells ignore presses', () => {
  const state = toggleMode(fromPicture(PICTURE))
  const flagged = toggleMode(press(state, 2, 2))
  const opened = press(flagged, 4, 4)

  expect(opened.board[2]?.[2]?.isRevealed).toBe(false)
  expect(press(opened, 4, 4)).toBe(opened)
})

test('V3 mines: a first open at a corner or an edge is safe too', () => {
  for (const [r, c] of [
    [0, 0],
    [7, 7],
    [0, 4],
    [5, 0],
  ] as const) {
    for (let seed = 1; seed <= 10; seed += 1) {
      const board = layMines(newMines().board, r, c, seeded(seed))
      expect(board.flat().filter(cell => cell.isMine)).toHaveLength(MINES)
      for (let dr = -1; dr <= 1; dr += 1)
        for (let dc = -1; dc <= 1; dc += 1)
          expect(board[r + dr]?.[c + dc]?.isMine ?? false).toBe(false)
    }
  }
})

test('V3 mines: a constant or out-of-range random still lays 10 mines outside the safe zone', () => {
  for (const stub of [() => 0.5, () => 0, () => 1, () => 0.9999999]) {
    const board = layMines(newMines().board, 1, 1, stub)
    expect(board.flat().filter(cell => cell.isMine)).toHaveLength(MINES)
    expect(board[0]?.[0]?.isMine).toBe(false)
    expect(press(newMines(), 1, 1, stub).status).not.toBe('lost')
  }
})

test('F10: flags placed before the first open are kept and stay shut', () => {
  const flagged = toggleMode(press(toggleMode(newMines()), 4, 5))
  const opened = press(flagged, 4, 4, seeded(1))

  expect(opened.board[4]?.[5]?.isFlagged).toBe(true)
  expect(opened.board[4]?.[5]?.isRevealed).toBe(false)
  expect(flagsPlaced(opened)).toBe(1)
})
