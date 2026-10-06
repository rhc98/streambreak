import type { RenderSurface } from 'claude-code'

// Design tokens (plans/2026-10-05-streambreak-mod-design-system.md): the one place in the mod that
// names a color or a board glyph. Views use the roles, never a color string of their own.
//
// The values are Claude Code theme keys, so they follow the person's light / dark / daltonized /
// ANSI theme on every surface. Only promptBorder, inactive and permission are named in the engine's
// d.ts; the rest were read from the 2.1.286 binary. An unknown key draws in the default color with
// no error (D0), so check these names again on each engine bump.

export const tone = {
  /** Our own accent, used sparingly: the Gomoku AI's stones. */
  accent: 'claude',
  /** The person's own marks: their Gomoku stones. */
  you: 'suggestion',
  /** Level-1 borders: the featured news card and the game boards. */
  border: 'promptBorder',
  success: 'success',
  danger: 'error',
  warning: 'warning',
  /**
   * The theme's own text color, for bold headings: the terminal draws an uncolored bold run in its
   * default foreground, which vanishes on the light pane a light theme paints in a dark terminal.
   */
  text: 'text',
} as const

/**
 * Minesweeper numbers by count (index 0 unused): the classic 1 blue, 2 green, 3 red, then ones that
 * only need to differ. 7 and 8 keep the default color; they are rare and must not fade. The digits
 * themselves tell the counts apart where a theme merges two colors (daltonized: 1 and 2).
 */
export const MINE_COLOR = [
  undefined,
  tone.you,
  tone.success,
  tone.danger,
  // 4 and 6 have no theme key of their own; the raw ANSI names follow the terminal's palette, and
  // the desktop maps them to readable shades in both themes (D0).
  'magenta',
  tone.warning,
  'cyan',
  undefined,
  undefined,
] as const

export type Glyphs = {
  mineHidden: string
  mineFlag: string
  mine: string
  mineEmpty: string
  /** Gomoku: empty · the person · the AI. */
  stones: readonly [string, string, string]
  cardBack: string
}

// Terminal glyphs. One column wide in every terminal (the board is a grid of one-glyph controls);
// `·●○■` are East Asian Ambiguous and may draw two columns wide. The card back is the exception:
// every Memory card is a `[ … ]` Button holding a two-column emoji, so the rows still line up.
const ASCII: Glyphs = {
  mineHidden: '#',
  mineFlag: 'F',
  mine: '*',
  mineEmpty: '.',
  stones: ['+', 'X', 'O'],
  cardBack: '❓',
}

// The other surfaces draw each cell as a control of its own, so wider glyphs cannot shift the grid.
// An empty open cell is a no-break space: a plain space may collapse to nothing in a web view.
const RICH: Glyphs = {
  mineHidden: '■',
  mineFlag: '🚩',
  mine: '💣',
  mineEmpty: '\u00a0',
  stones: ['·', '●', '○'],
  cardBack: '❓',
}

export const glyphs = (surface: RenderSurface): Glyphs => (surface === 'terminal' ? ASCII : RICH)

/** Before the selected tab or game on the terminal. */
const SELECTED = '›'

/**
 * A tab or game label. The terminal draws a primary Button in the accent color alone, which the
 * ANSI and daltonized themes blur, so the selected one also gets a mark; the others keep its room,
 * so a selection never moves the buttons. Other surfaces fill the primary natively.
 */
export const selectableLabel = (surface: RenderSurface, label: string, isSelected: boolean) => {
  if (surface !== 'terminal') return label
  return isSelected ? `${SELECTED} ${label}` : `  ${label}`
}
