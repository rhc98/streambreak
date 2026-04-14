import { Circle, RotateCcw } from 'lucide-react'
import { useCallback, useState } from 'react'

const SIZE = 9
const WIN = 5

type Player = 0 | 1 | 2 // 0=empty, 1=black(user), 2=white(AI)
type Board = Player[][]

function createBoard(): Board {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0) as Player[])
}

function checkWin(board: Board, r: number, c: number, player: Player): boolean {
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ]
  for (const [dr, dc] of dirs) {
    let count = 1
    for (let d = 1; d < WIN; d++) {
      const nr = r + dr! * d
      const nc = c + dc! * d
      if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr]?.[nc] === player) {
        count++
      } else break
    }
    for (let d = 1; d < WIN; d++) {
      const nr = r - dr! * d
      const nc = c - dc! * d
      if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr]?.[nc] === player) {
        count++
      } else break
    }
    if (count >= WIN) return true
  }
  return false
}

function isFull(board: Board): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r]?.[c] === 0) return false
    }
  }
  return true
}

// Heuristic AI
function evaluateLine(
  board: Board,
  r: number,
  c: number,
  dr: number,
  dc: number,
  player: Player,
): number {
  const opp = player === 1 ? 2 : 1
  let count = 0
  let openEnds = 0
  let blocked = false

  // Forward
  for (let d = 1; d <= 4; d++) {
    const nr = r + dr * d
    const nc = c + dc * d
    if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) {
      blocked = true
      break
    }
    if (board[nr]?.[nc] === player) count++
    else if (board[nr]?.[nc] === opp) {
      blocked = true
      break
    } else {
      openEnds++
      break
    }
  }

  // Backward
  let blockedBack = false
  for (let d = 1; d <= 4; d++) {
    const nr = r - dr * d
    const nc = c - dc * d
    if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) {
      blockedBack = true
      break
    }
    if (board[nr]?.[nc] === player) count++
    else if (board[nr]?.[nc] === opp) {
      blockedBack = true
      break
    } else {
      openEnds++
      break
    }
  }

  if (blocked && blockedBack && count < 4) return 0

  // Score based on pattern
  if (count >= 4) return 100000
  if (count === 3 && openEnds === 2) return 10000
  if (count === 3 && openEnds === 1) return 1000
  if (count === 2 && openEnds === 2) return 500
  if (count === 2 && openEnds === 1) return 100
  if (count === 1 && openEnds === 2) return 50
  if (count === 1 && openEnds === 1) return 10
  return 0
}

function scorePosition(board: Board, r: number, c: number, player: Player): number {
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ]
  let total = 0
  for (const [dr, dc] of dirs) {
    total += evaluateLine(board, r, c, dr!, dc!, player)
  }
  // Prefer center
  const centerDist = Math.abs(r - Math.floor(SIZE / 2)) + Math.abs(c - Math.floor(SIZE / 2))
  total += Math.max(0, (SIZE - centerDist) * 2)
  return total
}

function aiMove(board: Board): [number, number] | null {
  let bestScore = -1
  let bestMoves: [number, number][] = []

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r]?.[c] !== 0) continue

      // Check if near existing stones (optimization)
      let near = false
      for (let dr = -2; dr <= 2 && !near; dr++) {
        for (let dc = -2; dc <= 2 && !near; dc++) {
          const nr = r + dr
          const nc = c + dc
          if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr]?.[nc] !== 0) {
            near = true
          }
        }
      }
      // First move or near existing stones
      const totalStones = board.flat().filter(v => v !== 0).length
      if (!near && totalStones > 0) continue

      const attackScore = scorePosition(board, r, c, 2) // AI attack
      const defendScore = scorePosition(board, r, c, 1) // Block player
      const score = attackScore * 1.1 + defendScore

      if (score > bestScore) {
        bestScore = score
        bestMoves = [[r, c]]
      } else if (score === bestScore) {
        bestMoves.push([r, c])
      }
    }
  }

  if (bestMoves.length === 0) return null
  return bestMoves[Math.floor(Math.random() * bestMoves.length)]!
}

type GameResult = null | 'black' | 'white' | 'draw'

export default function Gomoku() {
  const [board, setBoard] = useState<Board>(createBoard)
  const [result, setResult] = useState<GameResult>(null)
  const [lastMove, setLastMove] = useState<[number, number] | null>(null)
  const [thinking, setThinking] = useState(false)

  const handleClick = useCallback(
    (r: number, c: number) => {
      if (result || thinking) return
      if (board[r]?.[c] !== 0) return

      const newBoard = board.map(row => [...row]) as Board
      newBoard[r]![c] = 1
      setBoard(newBoard)
      setLastMove([r, c])

      if (checkWin(newBoard, r, c, 1)) {
        setResult('black')
        return
      }
      if (isFull(newBoard)) {
        setResult('draw')
        return
      }

      // AI turn
      setThinking(true)
      setTimeout(() => {
        const move = aiMove(newBoard)
        if (move) {
          const [ar, ac] = move
          newBoard[ar]![ac] = 2
          setBoard([...newBoard.map(row => [...row])] as Board)
          setLastMove([ar, ac])

          if (checkWin(newBoard, ar, ac, 2)) {
            setResult('white')
          } else if (isFull(newBoard)) {
            setResult('draw')
          }
        }
        setThinking(false)
      }, 150)
    },
    [board, result, thinking],
  )

  function reset() {
    setBoard(createBoard())
    setResult(null)
    setLastMove(null)
    setThinking(false)
  }

  const moveCount = board.flat().filter(v => v !== 0).length

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2">
      <div className="flex w-full items-center justify-between px-1">
        <div className="flex gap-4">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
              Turn
            </div>
            <div className="flex items-center gap-1.5 text-sm font-bold">
              {result ? (
                <span className="text-[var(--accent)]">
                  {result === 'black' ? 'You Win!' : result === 'white' ? 'AI Wins' : 'Draw'}
                </span>
              ) : (
                <span
                  className={
                    thinking ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'
                  }
                >
                  {thinking ? 'AI...' : 'Your turn'}
                </span>
              )}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
              Moves
            </div>
            <div className="text-sm font-bold tabular-nums text-[var(--text-primary)]">
              {moveCount}
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

      <div className="relative rounded-xl bg-[var(--bg-secondary)] p-3">
        {/* Grid lines */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${SIZE}, 33px)`,
            gridTemplateRows: `repeat(${SIZE}, 33px)`,
          }}
        >
          {Array.from({ length: SIZE * SIZE }, (_, i) => {
            const r = Math.floor(i / SIZE)
            const c = i % SIZE
            const stone = board[r]?.[c]
            const isLast = lastMove?.[0] === r && lastMove?.[1] === c

            return (
              <button
                type="button"
                key={`${r}-${c}`}
                onClick={() => handleClick(r, c)}
                className="relative flex items-center justify-center"
                disabled={thinking || result !== null}
              >
                {/* Grid lines */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className="absolute bg-[var(--text-tertiary)]"
                    style={{
                      width: r === 0 || r === SIZE - 1 ? 0 : 1,
                      height: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      opacity: 0.3,
                      ...(r === 0
                        ? { top: '50%', height: '50%' }
                        : r === SIZE - 1
                          ? { bottom: '50%', height: '50%' }
                          : {}),
                    }}
                  />
                  <div
                    className="absolute bg-[var(--text-tertiary)]"
                    style={{
                      height: c === 0 || c === SIZE - 1 ? 0 : 1,
                      width: '100%',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      opacity: 0.3,
                      ...(c === 0
                        ? { left: '50%', width: '50%' }
                        : c === SIZE - 1
                          ? { right: '50%', width: '50%' }
                          : {}),
                    }}
                  />
                </div>

                {/* Stone */}
                {stone !== 0 && (
                  <div
                    className={`z-10 flex h-[26px] w-[26px] items-center justify-center rounded-full transition-all duration-150 ${
                      stone === 1
                        ? 'bg-[var(--text-primary)] shadow-[0_2px_4px_rgba(0,0,0,0.5)]'
                        : 'bg-[var(--text-tertiary)] shadow-[0_2px_4px_rgba(0,0,0,0.3)]'
                    } ${isLast ? 'ring-2 ring-[var(--accent)]' : ''}`}
                  />
                )}

                {/* Hover indicator */}
                {stone === 0 && !result && !thinking && (
                  <div className="z-10 h-[26px] w-[26px] rounded-full opacity-0 transition-opacity hover:bg-[var(--text-primary)] hover:opacity-20" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {result ? (
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-[var(--accent)] px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
        >
          Play Again
        </button>
      ) : (
        <div className="flex items-center gap-2 text-[10px] text-[var(--text-tertiary)]">
          <Circle size={8} fill="currentColor" className="text-[var(--text-primary)]" />
          <span>you (black)</span>
          <span className="opacity-40">vs</span>
          <Circle size={8} fill="currentColor" className="text-[var(--text-tertiary)]" />
          <span>AI (white)</span>
        </div>
      )}
    </div>
  )
}
