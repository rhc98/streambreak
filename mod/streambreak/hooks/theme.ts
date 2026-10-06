import type { RenderSurface } from 'claude-code'

// Design tokens (plans/2026-10-05-streambreak-mod-design-system.md): the one place in the mod that
// names a color or a board glyph. Views use the roles, never a color string of their own.
//
// The values are Claude Code theme keys, so they follow the person's light / dark / daltonized /
// ANSI theme on every surface. Only promptBorder, inactive and permission are named in the engine's
// d.ts; the rest were read from the 2.1.286 binary. An unknown key draws in the default color with
// no error (D0), so check these names again on each engine bump.

export const tone = {
  /** Level-1 borders: the featured news card and the game boards. */
  border: 'promptBorder',
  success: 'success',
  danger: 'error',
  warning: 'warning',
} as const

// Terminal glyphs. One column wide in every terminal (the board is a grid of one-glyph controls);
// `·●○` are East Asian Ambiguous and may draw two columns wide. The card back is the exception:
// every Memory card is a `[ … ]` Button holding a two-column emoji, so the rows still line up.
export const GLYPHS = {
  mineHidden: '#',
  mineFlag: 'F',
  mine: '*',
  mineEmpty: '.',
  /** Gomoku: empty · the person · the AI. */
  stones: ['+', 'X', 'O'],
  cardBack: '❓',
  /** Before the selected tab or game on the terminal. */
  selected: '›',
} as const

/**
 * A tab or game label. The terminal draws a primary Button in the accent color alone, which the
 * ANSI and daltonized themes blur, so the selected one also gets a mark; the others keep its room,
 * so a selection never moves the buttons. Other surfaces fill the primary natively.
 */
export const selectableLabel = (surface: RenderSurface, label: string, isSelected: boolean) => {
  if (surface !== 'terminal') return label
  return isSelected ? `${GLYPHS.selected} ${label}` : `  ${label}`
}
