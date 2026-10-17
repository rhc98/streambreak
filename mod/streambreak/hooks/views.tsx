// F17: the pane's chrome and news drawing. No `$` here (validate rule): register.tsx reads the
// state and builds the handlers; this file only lays them out. Box / Text / Button / Link only,
// so every surface (mobile included) draws it.
import type { Elements, RenderSurface } from 'claude-code'

import type { NewsItem, Phase, Tab } from '../types'
import { cleanText, safeHref, timeAgo } from './feed'
import type { Strings } from './i18n'
import { selectableLabel, tone } from './theme'

type Els = Elements[RenderSurface]

// Wide glyphs (Hangul, CJK, fullwidth, most emoji) take two terminal columns.
const isWide = (code: number) =>
  (code >= 0x1100 && code <= 0x115f) ||
  (code >= 0x2e80 && code <= 0xa4cf) ||
  (code >= 0xac00 && code <= 0xd7a3) ||
  (code >= 0xf900 && code <= 0xfaff) ||
  (code >= 0xfe30 && code <= 0xfe4f) ||
  (code >= 0xff00 && code <= 0xff60) ||
  (code >= 0xffe0 && code <= 0xffe6) ||
  (code >= 0x1f300 && code <= 0x1faff)

// Symbols drawn as emoji by default (☕ ⚡ ❓ ✅ ⭐ …) are wide too, wherever they sit. A flag's two
// regional-indicator letters count 2 each (4 for the pair, 2 drawn): wide errs safe for clip().
const EMOJI = /\p{Emoji_Presentation}/u

export const columnsOf = (text: string) =>
  Array.from(text).reduce(
    (width, char) => width + (isWide(char.codePointAt(0) ?? 0) || EMOJI.test(char) ? 2 : 1),
    0,
  )

/** `text` cut to `width` columns with an ellipsis; unchanged when it fits. */
export const clip = (text: string, width: number) => {
  if (columnsOf(text) <= width) return text
  let out = ''
  for (const char of Array.from(text)) {
    if (columnsOf(`${out}${char}`) > width - 1) break
    out += char
  }
  return `${out}…`
}

export type ChromeHandlers = {
  onTab: (tab: Tab) => () => void
  onLanguage: () => void
  onClose: () => void
}

/** One status row, always drawn, so a phase change never moves the board under the pointer. */
const statusSlot = (els: Els, t: Strings, phase: Phase) => {
  const { Box, Text } = els
  if (phase === 'done') {
    return (
      <Box key="banner">
        <Text bold color={tone.success}>
          {t.done}
        </Text>
      </Box>
    )
  }
  const isWorking = phase === 'working' || phase === 'suggested'
  return (
    <Box key="status" minHeight={1}>
      <Text dimColor>{isWorking ? t.working : '\u00a0'}</Text>
    </Box>
  )
}

/** The mark and tabs on the left, language and close on the right; the status row below. */
export const chrome = (
  els: Els,
  t: Strings,
  surface: RenderSurface,
  tab: Tab,
  phase: Phase,
  on: ChromeHandlers,
) => {
  const { Box, Text, Button } = els
  const tabLabel = (name: Tab) => selectableLabel(surface, t[name], tab === name)

  return (
    <Box key="chrome" flexDirection="column" gap={1}>
      <Box flexDirection="row" justifyContent="space-between" flexWrap="wrap" columnGap={1}>
        <Box flexDirection="row" gap={1} alignItems="center">
          <Text>☕</Text>
          <Button
            key="tab:news"
            variant={tab === 'news' ? 'primary' : 'secondary'}
            onPress={on.onTab('news')}
          >
            {tabLabel('news')}
          </Button>
          <Button
            key="tab:games"
            variant={tab === 'games' ? 'primary' : 'secondary'}
            onPress={on.onTab('games')}
          >
            {tabLabel('games')}
          </Button>
        </Box>
        <Box flexDirection="row" gap={1}>
          <Button key="lang" onPress={on.onLanguage}>
            {t.switchLanguage}
          </Button>
          <Button key="close" role="dismiss" onPress={on.onClose}>
            {t.close}
          </Button>
        </Box>
      </Box>
      {statusSlot(els, t, phase)}
    </Box>
  )
}

export type NewsView = {
  items: readonly NewsItem[]
  /** The visible window, the first one the featured card. */
  shown: readonly NewsItem[]
  index: number
  isOffline: boolean
  isLoading: boolean
  now: number
  columns: number
  surface: RenderSurface
}

const linkOrText = (els: Els, item: NewsItem, label: string) => {
  const { Text, Link } = els
  const href = safeHref(item.url)
  return href ? <Link href={href} label={label} /> : <Text>{label}</Text>
}

// A terminal cannot say whether it draws links (OSC 8): one that does shows a Link as plain text,
// one that does not appends the whole URL, which breaks a one-line row (D0). So on the terminal the
// rows are text and only the featured card links, underlined as the cue; elsewhere all of them link.
const featuredTitle = (els: Els, item: NewsItem, label: string, surface: RenderSurface) => {
  const { Text } = els
  // The underline promises a link: none when the URL is not one we would open.
  return surface === 'terminal' ? (
    <Text bold underline={safeHref(item.url) !== undefined} color={tone.text}>
      {linkOrText(els, item, label)}
    </Text>
  ) : (
    <Text bold>{linkOrText(els, item, label)}</Text>
  )
}

const rowTitle = (els: Els, item: NewsItem, label: string, surface: RenderSurface) => {
  const { Text } = els
  return surface === 'terminal' ? <Text>{label}</Text> : linkOrText(els, item, label)
}

/** One featured card in a border, the next ones as single dim lines. */
export const newsView = (els: Els, t: Strings, view: NewsView) => {
  const { Box, Text } = els
  const [featured, ...rest] = view.shown
  const meta = (item: NewsItem) => {
    const ago = timeAgo(item.published_at, view.now, t.ago)
    return `${cleanText(item.source)}${ago ? ` · ${ago}` : ''}`
  }
  const position = view.items.length > 0 ? (view.index % view.items.length) + 1 : 0
  // Room for a one-line row: the pane less the source/time text and a little air.
  const rowWidth = (item: NewsItem) => Math.max(12, view.columns - columnsOf(meta(item)) - 6)

  return (
    <Box key="news" flexDirection="column" gap={1}>
      <Box flexDirection="row" justifyContent="space-between">
        <Text dimColor>
          {view.items.length > 0 ? t.newsPosition(position, view.items.length) : ''}
        </Text>
        {view.isOffline && view.items.length > 0 && <Text color={tone.warning}>{t.offline}</Text>}
      </Box>
      {view.items.length === 0 &&
        (view.isLoading ? (
          <Text dimColor>{t.loading}</Text>
        ) : view.isOffline ? (
          <Text color={tone.warning}>{t.newsOfflineEmpty}</Text>
        ) : (
          <Text dimColor>{t.newsEmpty}</Text>
        ))}
      {featured && (
        <Box
          key={`card:${featured.url || featured.title}`}
          flexDirection="column"
          borderStyle="round"
          borderColor={tone.border}
          paddingX={1}
        >
          {featuredTitle(
            els,
            featured,
            cleanText(`${featured.icon} ${featured.title}`),
            view.surface,
          )}
          <Text dimColor>{meta(featured)}</Text>
        </Box>
      )}
      {rest.length > 0 && (
        <Box flexDirection="column" paddingX={1}>
          {rest.map(item => (
            <Box key={`card:${item.url || item.title}`} flexDirection="row" gap={1}>
              {rowTitle(
                els,
                item,
                clip(cleanText(`${item.icon} ${item.title}`), rowWidth(item)),
                view.surface,
              )}
              <Text dimColor>{meta(item)}</Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
