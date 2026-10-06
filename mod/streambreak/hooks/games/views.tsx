// Game drawings. No `$` here (validate rule): register.tsx passes the surface's element table,
// the state it read, and the handlers it built. Only Box / Text / Button, which every surface has.
import type { Elements, RenderSurface } from 'claude-code'

import type { GameKind, GomokuState, MemoryState, MineCell, MinesState } from '../../types'
import type { Strings } from '../i18n'
import { GLYPHS, tone } from '../theme'
import { SIZE } from './gomoku'
import { elapsedSeconds, SYMBOLS } from './memory'
import { flagsPlaced, MINES } from './minesweeper'

type Els = Elements[RenderSurface]

/** The games the tab offers, in selector order. */
export const AVAILABLE_GAMES = [
  'memory',
  'minesweeper',
  'gomoku',
] as const satisfies readonly GameKind[]

const COLUMNS = 'abcdefghi'
export const cellName = (r: number, c: number) => `${COLUMNS[c] ?? '?'}${r + 1}`

export const gameSelector = (
  els: Els,
  t: Strings,
  current: GameKind | null,
  onPick: (game: GameKind) => void,
  onNew: () => void,
) => {
  const { Box, Button } = els

  return (
    <Box flexDirection="row" gap={1}>
      {AVAILABLE_GAMES.map(game => (
        <Button
          key={`game:${game}`}
          variant={current === game ? 'primary' : 'secondary'}
          onPress={() => onPick(game)}
        >
          {t[game]}
        </Button>
      ))}
      <Button key="game:new" onPress={onNew}>
        {t.newGame}
      </Button>
    </Box>
  )
}

export const memoryView = (
  els: Els,
  t: Strings,
  state: MemoryState,
  now: number,
  onFlip: (index: number) => void,
) => {
  const { Box, Text, Button } = els
  const seconds = elapsedSeconds(state, now)
  // Cards and cells never move, so a position is their identity; keys are built here as data.
  const rows = [0, 1, 2, 3].map(row => ({
    key: `memory:row:${row}`,
    cards: state.cards.slice(row * 4, row * 4 + 4).map((card, column) => ({
      card,
      index: row * 4 + column,
      key: `memory:${row * 4 + column}`,
    })),
  }))

  return (
    <Box
      key="memory"
      flexDirection="column"
      gap={1}
      borderStyle="round"
      borderColor={tone.border}
      paddingX={1}
    >
      <Text
        bold={state.finishedAt !== null}
        color={state.finishedAt !== null ? tone.success : undefined}
      >
        {state.finishedAt !== null
          ? t.memoryDone(state.moves, seconds)
          : t.memoryStatus(state.moves, seconds)}
      </Text>
      {rows.map(line => (
        <Box key={line.key} flexDirection="row" gap={1}>
          {line.cards.map(({ card, index, key }) => {
            const isShown = card.isFaceUp || card.isMatched
            return (
              <Button key={key} dimColor={card.isMatched} onPress={() => onFlip(index)}>
                {isShown ? (SYMBOLS[card.symbol] ?? '?') : GLYPHS.cardBack}
              </Button>
            )
          })}
        </Box>
      ))}
    </Box>
  )
}

// A draw is neither side's: the default color, bold like the other results.
export const RESULT_COLOR = { black: tone.success, white: tone.danger, draw: undefined } as const

export const gomokuView = (
  els: Els,
  t: Strings,
  state: GomokuState,
  onPlay: (r: number, c: number) => void,
) => {
  const { Box, Text, Button } = els
  const [lr, lc] = state.lastMove ?? [-1, -1]
  const lastAi = state.lastMove && state.board[lr]?.[lc] === 2 ? cellName(lr, lc) : null
  const header = [...COLUMNS.slice(0, SIZE)].map(label => ({ key: `gomoku:col:${label}`, label }))
  const grid = state.board.map((row, r) => ({
    key: `gomoku:row:${r}`,
    label: String(r + 1).padStart(2, ' '),
    cells: row.map((stone, c) => ({ stone, r, c, key: `gomoku:${r}:${c}` })),
  }))

  return (
    <Box
      key="gomoku"
      flexDirection="column"
      borderStyle="round"
      borderColor={tone.border}
      paddingX={1}
    >
      <Text
        bold={state.result !== null}
        color={state.result ? RESULT_COLOR[state.result] : undefined}
      >
        {state.result ? t.gomokuResult[state.result] : t.gomokuTurn(lastAi)}
      </Text>
      <Box key="gomoku:header" flexDirection="row" gap={1}>
        <Text dimColor>{'  '}</Text>
        {header.map(column => (
          <Text key={column.key} dimColor>
            {column.label}
          </Text>
        ))}
      </Box>
      {grid.map(line => (
        <Box key={line.key} flexDirection="row" gap={1}>
          <Text dimColor>{line.label}</Text>
          {line.cells.map(({ stone, r, c, key }) => (
            <Button key={key} plain dimColor={stone === 0} onPress={() => onPlay(r, c)}>
              {GLYPHS.stones[stone]}
            </Button>
          ))}
        </Box>
      ))}
    </Box>
  )
}

const mineLabel = (cell: MineCell) => {
  if (cell.isFlagged && !cell.isRevealed) return GLYPHS.mineFlag
  if (!cell.isRevealed) return GLYPHS.mineHidden
  if (cell.isMine) return GLYPHS.mine
  return cell.adjacent === 0 ? GLYPHS.mineEmpty : String(cell.adjacent)
}

export const minesView = (
  els: Els,
  t: Strings,
  state: MinesState,
  onPress: (r: number, c: number) => void,
  onToggleMode: () => void,
) => {
  const { Box, Text, Button } = els
  const grid = state.board.map((row, r) => ({
    key: `mines:row:${r}`,
    cells: row.map((cell, c) => ({ cell, r, c, key: `mines:${r}:${c}` })),
  }))

  return (
    <Box
      key="minesweeper"
      flexDirection="column"
      borderStyle="round"
      borderColor={tone.border}
      paddingX={1}
    >
      <Box flexDirection="row" gap={1}>
        <Text
          bold={state.status !== 'playing'}
          color={
            state.status === 'won'
              ? tone.success
              : state.status === 'lost'
                ? tone.danger
                : undefined
          }
        >
          {state.status === 'playing'
            ? t.minesStatus(MINES - flagsPlaced(state))
            : t.minesResult[state.status]}
        </Text>
        {state.status === 'playing' && (
          <Button key="mines:mode" onPress={onToggleMode}>
            {t.minesMode[state.mode]}
          </Button>
        )}
      </Box>
      {grid.map(line => (
        <Box key={line.key} flexDirection="row" gap={1}>
          {line.cells.map(({ cell, r, c, key }) => (
            <Button
              key={key}
              plain
              dimColor={cell.isRevealed && !cell.isMine}
              onPress={() => onPress(r, c)}
            >
              {mineLabel(cell)}
            </Button>
          ))}
        </Box>
      ))}
    </Box>
  )
}
