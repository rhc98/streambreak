import { Bomb, Flag, RotateCcw } from 'lucide-react'
import { useCallback, useState } from 'react'

const ROWS = 8
const COLS = 8
const MINES = 10

type CellState = {
  mine: boolean
  revealed: boolean
  flagged: boolean
  adjacent: number
}

type GameState = 'playing' | 'won' | 'lost'

function createBoard(firstR?: number, firstC?: number): CellState[][] {
  const board: CellState[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({
      mine: false,
      revealed: false,
      flagged: false,
      adjacent: 0,
    })),
  )

  // Place mines (avoid first click area)
  let placed = 0
  while (placed < MINES) {
    const r = Math.floor(Math.random() * ROWS)
    const c = Math.floor(Math.random() * COLS)
    if (board[r]![c]!.mine) continue
    if (firstR !== undefined && Math.abs(r - firstR) <= 1 && Math.abs(c - firstC!) <= 1) continue
    board[r]![c]!.mine = true
    placed++
  }

  // Calculate adjacents
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r]![c]!.mine) continue
      let count = 0
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr
          const nc = c + dc
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && board[nr]![nc]!.mine) {
            count++
          }
        }
      }
      board[r]![c]!.adjacent = count
    }
  }

  return board
}

function reveal(board: CellState[][], r: number, c: number): CellState[][] {
  const newBoard = board.map(row => row.map(cell => ({ ...cell })))
  const stack: [number, number][] = [[r, c]]

  while (stack.length > 0) {
    const [cr, cc] = stack.pop()!
    const cell = newBoard[cr]![cc]!
    if (cell.revealed || cell.flagged) continue
    cell.revealed = true

    if (cell.adjacent === 0 && !cell.mine) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = cr + dr
          const nc = cc + dc
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !newBoard[nr]![nc]!.revealed) {
            stack.push([nr, nc])
          }
        }
      }
    }
  }

  return newBoard
}

function checkWin(board: CellState[][]): boolean {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = board[r]![c]!
      if (!cell.mine && !cell.revealed) return false
    }
  }
  return true
}

const NUM_COLORS: Record<number, string> = {
  1: '#60a5fa',
  2: '#4ade80',
  3: '#f87171',
  4: '#c084fc',
  5: '#fb923c',
  6: '#22d3ee',
  7: '#e8eaed',
  8: '#8b8fa3',
}

export default function Minesweeper() {
  const [board, setBoard] = useState<CellState[][]>(() => createBoard())
  const [gameState, setGameState] = useState<GameState>('playing')
  const [firstClick, setFirstClick] = useState(true)
  const [flagCount, setFlagCount] = useState(0)

  const handleClick = useCallback(
    (r: number, c: number) => {
      if (gameState !== 'playing') return
      const cell = board[r]![c]!
      if (cell.revealed || cell.flagged) return

      let currentBoard = board
      if (firstClick) {
        currentBoard = createBoard(r, c)
        setFirstClick(false)
      }

      if (currentBoard[r]![c]!.mine) {
        // Reveal all mines
        const lost = currentBoard.map(row =>
          row.map(cell => (cell.mine ? { ...cell, revealed: true } : { ...cell })),
        )
        setBoard(lost)
        setGameState('lost')
        return
      }

      const newBoard = reveal(currentBoard, r, c)
      setBoard(newBoard)
      if (checkWin(newBoard)) {
        setGameState('won')
      }
    },
    [board, gameState, firstClick],
  )

  const handleRightClick = useCallback(
    (e: React.MouseEvent, r: number, c: number) => {
      e.preventDefault()
      if (gameState !== 'playing') return
      const cell = board[r]![c]!
      if (cell.revealed) return

      const newBoard = board.map(row => row.map(cell => ({ ...cell })))
      const target = newBoard[r]![c]!
      target.flagged = !target.flagged
      setBoard(newBoard)
      setFlagCount(prev => prev + (target.flagged ? 1 : -1))
    },
    [board, gameState],
  )

  function reset() {
    setBoard(createBoard())
    setGameState('playing')
    setFirstClick(true)
    setFlagCount(0)
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <div className="flex w-full items-center justify-between px-1">
        <div className="flex gap-4">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
              Mines
            </div>
            <div className="text-lg font-bold tabular-nums text-[var(--accent)]">
              {MINES - flagCount}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
              Status
            </div>
            <div className="text-lg font-bold text-[var(--text-primary)]">
              {gameState === 'won' ? 'Win!' : gameState === 'lost' ? 'Boom' : '...'}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] transition-all hover:border-[rgba(255,255,255,0.1)] hover:text-[var(--text-primary)]"
        >
          <RotateCcw size={12} />
          New Game
        </button>
      </div>

      <div className="grid grid-cols-8 gap-[3px] rounded-xl bg-[var(--bg-secondary)] p-2">
        {board.flat().map((cell, i) => {
          const r = Math.floor(i / COLS)
          const c = i % COLS
          return (
            <button
              type="button"
              key={`${r}-${c}`}
              onClick={() => handleClick(r, c)}
              onContextMenu={e => handleRightClick(e, r, c)}
              className={`flex h-[36px] w-[36px] items-center justify-center rounded text-xs font-bold transition-colors duration-75 ${
                cell.revealed
                  ? cell.mine
                    ? 'bg-[var(--accent)]/30 text-[var(--accent)]'
                    : 'bg-[var(--bg-primary)]'
                  : 'bg-[var(--bg-card)] hover:bg-[var(--bg-card-active)]'
              }`}
            >
              {cell.revealed ? (
                cell.mine ? (
                  <Bomb size={14} />
                ) : cell.adjacent > 0 ? (
                  <span style={{ color: NUM_COLORS[cell.adjacent] }}>{cell.adjacent}</span>
                ) : null
              ) : cell.flagged ? (
                <Flag size={13} className="text-[var(--accent)]" />
              ) : null}
            </button>
          )
        })}
      </div>

      {gameState !== 'playing' && (
        <div className="text-center">
          <p className="text-sm font-semibold text-[var(--accent)]">
            {gameState === 'won' ? 'You Win!' : 'Game Over!'}
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-2 rounded-lg bg-[var(--accent)] px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
          >
            Play Again
          </button>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="flex items-center gap-2 text-[10px] text-[var(--text-tertiary)]">
          <span>click to reveal</span>
          <span className="opacity-40">|</span>
          <span>right-click to flag</span>
        </div>
      )}
    </div>
  )
}
