// Game drawings. No `$` here (validate rule): register.tsx passes the surface's element table,
// the state it read, and the handlers it built. Only Box / Text / Button, which every surface has.
import type { Elements, RenderSurface } from 'claude-code'

import type { GameKind, GomokuState, MemoryState, MineCell, MinesState, Stone } from '../../types'
import type { Strings } from '../i18n'
import { type Glyphs, MINE_COLOR, selectableLabel, tone } from '../theme'
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
  surface: RenderSurface,
  current: GameKind | null,
  onPick: (game: GameKind) => void,
  onNew: () => void,
) => {
  const { Box, Button } = els

  return (
    <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
      {AVAILABLE_GAMES.map(game => (
        <Button
          key={`game:${game}`}
          variant={current === game ? 'primary' : 'secondary'}
          onPress={() => onPick(game)}
        >
          {selectableLabel(surface, t[game], current === game)}
        </Button>
      ))}
      <Button key="game:new" onPress={onNew}>
        {t.newGame}
      </Button>
    </Box>
  )
}

/** The narrowest pane body, in columns, each board fits in: grid, border and padding. */
export const BOARD_COLUMNS = { memory: 31, minesweeper: 19, gomoku: 24 } as const satisfies Record<
  GameKind,
  number
>

/** Shown once a game is over, beside its result, so the next round is one press away. */
const newGameButton = (els: Els, t: Strings, onNew: () => void) => {
  const { Button } = els
  return (
    <Button key="game:new:result" onPress={onNew}>
      {t.newGame}
    </Button>
  )
}

export const memoryView = (
  els: Els,
  t: Strings,
  g: Glyphs,
  state: MemoryState,
  now: number,
  onFlip: (index: number) => void,
  onNew: () => void,
) => {
  const { Box, Text, Button } = els
  const seconds = elapsedSeconds(state, now)
  const isDone = state.finishedAt !== null
  // Cards and cells never move, so a position is their identity; keys are built here as data.
  const rows = [0, 1, 2, 3].map(row => ({
    key: `memory:row:${row}`,
    cards: state.cards.slice(row * 4, row * 4 + 4).map((card, column) => ({
      card,
      index: row * 4 + column,
      key: `memory:${row * 4 + column}`,
    })),
  }))

  // Every card stays a Button, matched ones too: a face-up card can be pressed again (F8), and
  // one [ … ] width keeps the rows aligned.
  return (
    <Box
      key="memory"
      flexDirection="column"
      gap={1}
      borderStyle="round"
      borderColor={tone.border}
      paddingX={1}
    >
      <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
        <Text bold={isDone} color={isDone ? tone.success : undefined}>
          {isDone ? t.memoryDone(state.moves, seconds) : t.memoryStatus(state.moves, seconds)}
        </Text>
        {isDone && newGameButton(els, t, onNew)}
      </Box>
      {rows.map(line => (
        <Box key={line.key} flexDirection="row" gap={1}>
          {line.cards.map(({ card, index, key }) => {
            const isShown = card.isFaceUp || card.isMatched
            return (
              <Button key={key} dimColor={card.isMatched} onPress={() => onFlip(index)}>
                {isShown ? (SYMBOLS[card.symbol] ?? '?') : g.cardBack}
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
  g: Glyphs,
  state: GomokuState,
  onPlay: (r: number, c: number) => void,
  onNew: () => void,
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

  // Only an empty point of a running game is a control. Stones are colored Text (a Button takes no
  // color); the AI's last move is underlined, since the focus ring already inverts.
  const cell = (stone: Stone, r: number, c: number, key: string) => {
    if (stone === 0 && state.result === null) {
      return (
        <Button key={key} plain dimColor onPress={() => onPlay(r, c)}>
          {g.stones[0]}
        </Button>
      )
    }
    const isLastAi = r === lr && c === lc && stone === 2
    return (
      <Box key={key}>
        <Text
          bold={stone !== 0}
          dimColor={stone === 0}
          underline={isLastAi}
          color={stone === 1 ? tone.you : stone === 2 ? tone.accent : undefined}
        >
          {g.stones[stone]}
        </Text>
      </Box>
    )
  }

  return (
    <Box
      key="gomoku"
      flexDirection="column"
      borderStyle="round"
      borderColor={tone.border}
      paddingX={1}
    >
      <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
        <Text
          bold={state.result !== null}
          color={state.result ? RESULT_COLOR[state.result] : undefined}
        >
          {state.result ? t.gomokuResult[state.result] : t.gomokuTurn(lastAi, g.stones[1])}
        </Text>
        {state.result !== null && newGameButton(els, t, onNew)}
      </Box>
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
          {line.cells.map(({ stone, r, c, key }) => cell(stone, r, c, key))}
        </Box>
      ))}
    </Box>
  )
}

export const minesView = (
  els: Els,
  t: Strings,
  g: Glyphs,
  state: MinesState,
  onPress: (r: number, c: number) => void,
  onToggleMode: () => void,
  onNew: () => void,
) => {
  const { Box, Text, Button } = els
  const isPlaying = state.status === 'playing'
  const grid = state.board.map((row, r) => ({
    key: `mines:row:${r}`,
    cells: row.map((cell, c) => ({ cell, r, c, key: `mines:${r}:${c}` })),
  }))

  // A shut cell of a running game is a control (open, or flag in flag mode, unflag included).
  // Everything else is Text: open cells carry the number colors, and a finished board is inert.
  const drawCell = (cell: MineCell, r: number, c: number, key: string) => {
    if (!cell.isRevealed && isPlaying) {
      return (
        <Button key={key} plain onPress={() => onPress(r, c)}>
          {cell.isFlagged ? g.mineFlag : g.mineHidden}
        </Button>
      )
    }
    if (!cell.isRevealed) {
      return (
        <Box key={key}>
          <Text dimColor>{cell.isFlagged ? g.mineFlag : g.mineHidden}</Text>
        </Box>
      )
    }
    if (cell.isMine) {
      return (
        <Box key={key}>
          <Text bold color={tone.danger}>
            {g.mine}
          </Text>
        </Box>
      )
    }
    return (
      <Box key={key}>
        {cell.adjacent === 0 ? (
          <Text dimColor>{g.mineEmpty}</Text>
        ) : (
          <Text bold color={MINE_COLOR[cell.adjacent]}>
            {String(cell.adjacent)}
          </Text>
        )}
      </Box>
    )
  }

  return (
    <Box
      key="minesweeper"
      flexDirection="column"
      borderStyle="round"
      borderColor={tone.border}
      paddingX={1}
    >
      <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
        <Text
          bold={!isPlaying}
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
        {isPlaying ? (
          <Button key="mines:mode" onPress={onToggleMode}>
            {t.minesMode[state.mode]}
          </Button>
        ) : (
          newGameButton(els, t, onNew)
        )}
      </Box>
      {grid.map(line => (
        <Box key={line.key} flexDirection="row" gap={1}>
          {line.cells.map(({ cell, r, c, key }) => drawCell(cell, r, c, key))}
        </Box>
      ))}
    </Box>
  )
}
