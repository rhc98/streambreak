// F17: the pane's chrome and news drawing. No `$` here (validate rule): register.tsx reads the
// state and builds the handlers; this file only lays them out. Box / Text / Button / Link only,
// so every surface (mobile included) draws it.
import type { Elements, RenderSurface } from 'claude-code'

import type { NewsItem, Phase, Tab } from '../types'
import { cleanText, safeHref, timeAgo } from './feed'
import type { Strings } from './i18n'

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

export const columnsOf = (text: string) =>
  Array.from(text).reduce((width, char) => width + (isWide(char.codePointAt(0) ?? 0) ? 2 : 1), 0)

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

/** Title and tabs on the left, language and close on the right; banner and status below. */
export const chrome = (els: Els, t: Strings, tab: Tab, phase: Phase, on: ChromeHandlers) => {
  const { Box, Text, Button } = els
  const isWorking = phase === 'working' || phase === 'suggested'

  return (
    <Box key="chrome" flexDirection="column" gap={1}>
      <Box flexDirection="row" justifyContent="space-between" flexWrap="wrap" gap={1}>
        <Box flexDirection="row" gap={1} alignItems="center">
          <Text bold color="cyan">
            ☕ streambreak
          </Text>
          <Button
            key="tab:news"
            variant={tab === 'news' ? 'primary' : 'secondary'}
            onPress={on.onTab('news')}
          >
            {t.news}
          </Button>
          <Button
            key="tab:games"
            variant={tab === 'games' ? 'primary' : 'secondary'}
            onPress={on.onTab('games')}
          >
            {t.games}
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
      {phase === 'done' && (
        <Box key="banner" borderStyle="round" borderColor="green" paddingX={1}>
          <Text bold color="green">
            {t.done}
          </Text>
        </Box>
      )}
      {isWorking && <Text dimColor>{t.working}</Text>}
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
}

const linkOrText = (els: Els, item: NewsItem, label: string) => {
  const { Text, Link } = els
  const href = safeHref(item.url)
  return href ? <Link href={href} label={label} /> : <Text>{label}</Text>
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
        {view.isOffline && <Text color="yellow">{t.offline}</Text>}
      </Box>
      {view.items.length === 0 && <Text dimColor>{view.isLoading ? t.loading : t.newsEmpty}</Text>}
      {featured && (
        <Box
          key={`card:${featured.url || featured.title}`}
          flexDirection="column"
          borderStyle="round"
          borderColor="cyan"
          paddingX={1}
        >
          {linkOrText(els, featured, cleanText(`${featured.icon} ${featured.title}`))}
          <Text dimColor>{meta(featured)}</Text>
        </Box>
      )}
      {rest.length > 0 && (
        <Box flexDirection="column" paddingX={1}>
          {rest.map(item => (
            <Box key={`card:${item.url || item.title}`} flexDirection="row" gap={1}>
              {linkOrText(els, item, clip(cleanText(`${item.icon} ${item.title}`), rowWidth(item)))}
              <Text dimColor>{meta(item)}</Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
