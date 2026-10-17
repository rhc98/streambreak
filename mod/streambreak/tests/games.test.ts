import { expect, test } from 'claude-code/testing'

import {
  aiMove,
  type Board,
  checkWin,
  createBoard,
  evaluateLine,
  newGomoku,
  playTurn,
} from '../hooks/games/gomoku'
import { elapsedSeconds, flip, newMemory, SYMBOLS, settleMismatch } from '../hooks/games/memory'
import type { MemoryState, Stone } from '../types'

// mulberry32: a deterministic `random` so decks and AI tie-breaks repeat.
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let x = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296
}

const boardWith = (stones: [number, number, Stone][]): Board => {
  const board = createBoard()
  for (const [r, c, stone] of stones) (board[r] as Stone[])[c] = stone
  return board
}

const pairOf = (state: MemoryState, index: number) =>
  state.cards.findIndex((card, i) => i !== index && card.symbol === state.cards[index]?.symbol)
const otherThan = (state: MemoryState, index: number) =>
  state.cards.findIndex((card, i) => i !== index && card.symbol !== state.cards[index]?.symbol)

// --- Memory Match (F8)

test('V3 memory: a new deck holds 16 face-down cards, each of 8 symbols twice', () => {
  const state = newMemory(seeded(1))

  expect(state.cards).toHaveLength(16)
  for (let symbol = 0; symbol < SYMBOLS.length; symbol += 1) {
    expect(state.cards.filter(card => card.symbol === symbol)).toHaveLength(2)
  }
  expect(state.cards.every(card => !card.isFaceUp && !card.isMatched)).toBe(true)
  expect(newMemory(seeded(1))).toEqual(state)
})

test('V3 memory: a matching pair stays up and counts one move', () => {
  const start = newMemory(seeded(2))
  const partner = pairOf(start, 0)
  const state = flip(flip(start, 0, 1_000), partner, 2_000)

  expect(state.cards[0]?.isMatched).toBe(true)
  expect(state.cards[partner]?.isMatched).toBe(true)
  expect(state.moves).toBe(1)
  expect(state.mismatch).toBeNull()
  expect(state.startedAt).toBe(1_000)
})

test('V3 memory: a mismatch waits as a pair, then turns back', () => {
  const start = newMemory(seeded(3))
  const other = otherThan(start, 0)
  const shown = flip(flip(start, 0, 0), other, 0)

  expect(shown.mismatch).toEqual([0, other])
  expect(shown.moves).toBe(1)
  const settled = settleMismatch(shown)
  expect(settled.cards[0]?.isFaceUp).toBe(false)
  expect(settled.cards[other]?.isFaceUp).toBe(false)
  expect(settled.mismatch).toBeNull()
})

test('V3 memory: a press during a pending mismatch settles it first', () => {
  const start = newMemory(seeded(4))
  const other = otherThan(start, 0)
  const third = start.cards.findIndex((_, i) => i !== 0 && i !== other)
  const state = flip(flip(flip(start, 0, 0), other, 0), third, 0)

  expect(state.mismatch).toBeNull()
  expect(state.cards.filter(card => card.isFaceUp).length).toBe(1)
  expect(state.cards[third]?.isFaceUp).toBe(true)
})

test('V3 memory: pressing a face-up or matched card changes nothing', () => {
  const start = newMemory(seeded(5))
  const once = flip(start, 0, 0)

  expect(flip(once, 0, 0)).toBe(once)
  const matched = flip(once, pairOf(start, 0), 0)
  expect(flip(matched, 0, 0)).toBe(matched)
})

test('V3 memory: the last pair finishes the game and stops the clock', () => {
  let state = newMemory(seeded(6))
  let now = 10_000
  for (let index = 0; index < 16; index += 1) {
    if (state.cards[index]?.isMatched) continue
    state = flip(state, index, now)
    state = flip(state, pairOf(state, index), now)
    now += 1_000
  }

  expect(state.finishedAt).toBe(now - 1_000)
  expect(state.moves).toBe(8)
  expect(elapsedSeconds(state, now + 99_000)).toBe(7)
  expect(flip(state, 0, now)).toBe(state)
})

// --- Gomoku (F9)

test('V3 gomoku: five in a row wins in every direction, four does not', () => {
  const row = boardWith([0, 1, 2, 3, 4].map(c => [4, c, 1] as [number, number, Stone]))
  const diagonal = boardWith([0, 1, 2, 3, 4].map(d => [d, 8 - d, 2] as [number, number, Stone]))

  expect(checkWin(row, 4, 2, 1)).toBe(true)
  expect(checkWin(diagonal, 2, 6, 2)).toBe(true)
  expect(
    checkWin(boardWith([0, 1, 2, 3].map(c => [4, c, 1] as [number, number, Stone])), 4, 0, 1),
  ).toBe(false)
})

test('V3 gomoku: evaluateLine keeps the Tauri scores', () => {
  const openThree = boardWith([
    [4, 3, 1],
    [4, 4, 1],
    [4, 5, 1],
  ])

  expect(evaluateLine(openThree, 4, 2, 0, 1, 1)).toBe(10000)
  expect(evaluateLine(openThree, 4, 6, 0, 1, 1)).toBe(10000)
  expect(evaluateLine(boardWith([]), 4, 4, 0, 1, 1)).toBe(0)
})

test('V3 gomoku: the AI takes a winning move when it has one', () => {
  const board = boardWith([
    [2, 2, 2],
    [2, 3, 2],
    [2, 4, 2],
    [2, 5, 2],
    [6, 6, 1],
    [6, 7, 1],
    [7, 6, 1],
  ])
  const move = aiMove(board, seeded(7))

  expect([
    [2, 1],
    [2, 6],
  ]).toContainEqual(move)
})

test('V3 gomoku: the AI blocks the person’s four', () => {
  const board = boardWith([
    [5, 1, 1],
    [5, 2, 1],
    [5, 3, 1],
    [5, 4, 1],
    [5, 0, 2],
    [0, 8, 2],
  ])

  expect(aiMove(board, seeded(8))).toEqual([5, 5])
})

test('V3 gomoku: on an empty board the AI opens in the centre', () => {
  expect(aiMove(createBoard(), seeded(9))).toEqual([4, 4])
})

test('F9: a turn places the person’s stone and the AI’s reply together', () => {
  const state = playTurn(newGomoku(), 4, 4, seeded(10))
  const stones = state.board.flat()

  expect(stones.filter(stone => stone === 1)).toHaveLength(1)
  expect(stones.filter(stone => stone === 2)).toHaveLength(1)
  expect(state.lastMove).not.toEqual([4, 4])
  expect(state.result).toBeNull()
})

test('F9: an occupied cell or a finished game changes nothing', () => {
  const state = playTurn(newGomoku(), 4, 4, seeded(11))
  const [ar, ac] = state.lastMove as [number, number]

  expect(playTurn(state, 4, 4)).toBe(state)
  expect(playTurn(state, ar, ac)).toBe(state)
  const won = { ...state, result: 'black' as const }
  expect(playTurn(won, 0, 0)).toBe(won)
})

test('F9: the person’s fifth stone wins before the AI moves', () => {
  const board = boardWith([
    [0, 0, 1],
    [0, 1, 1],
    [0, 2, 1],
    [0, 3, 1],
  ])
  const state = playTurn({ board, result: null, lastMove: null }, 0, 4, seeded(12))

  expect(state.result).toBe('black')
  expect(state.board.flat().filter(stone => stone === 2)).toHaveLength(0)
})
