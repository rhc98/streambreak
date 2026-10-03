// Pure feed logic: no `$`, so tests run it directly. The mod environment has no DOM and no Node,
// so this is a minimal RSS 2.0 / Atom reader covering what the three default feeds use.
import type { NewsItem } from '../types'
import type { Language } from './i18n'

export type FeedSource = { name: string; url: string; icon: string }

// Same sources and icons as the Tauri app's config.rs defaults.
export const FEEDS: Record<Language, readonly FeedSource[]> = {
  en: [
    { name: 'Hacker News', url: 'https://hnrss.org/frontpage', icon: '🔥' },
    { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', icon: '💡' },
  ],
  ko: [{ name: 'GeekNews', url: 'https://news.hada.io/rss/news', icon: '📰' }],
}

export const MAX_ITEMS = 10
export const VISIBLE_CARDS = 5

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

export const decodeEntities = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] !== '#') return NAMED_ENTITIES[name.toLowerCase()] ?? whole
    const code =
      name[1] === 'x' || name[1] === 'X'
        ? Number.parseInt(name.slice(2), 16)
        : Number(name.slice(1))
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff
      ? String.fromCodePoint(code)
      : whole
  })

// A CDATA section, consumed whole so markup inside it (even `</item>`) never ends a match early.
// Both patterns admit exactly one way to read any input (a CDATA body cannot run past its first
// `]]>`; a bare char cannot start a CDATA), so a missing close tag fails in linear time instead of
// backtracking exponentially over the CDATA sections.
const CDATA = String.raw`<!\[CDATA\[(?:[^\]]|\](?!\]>))*\]\]>`
const CONTENT = String.raw`(?:${CDATA}|[^<]|<(?!!\[CDATA\[))*?`
const withoutCdata = (text: string) => text.replace(new RegExp(CDATA, 'g'), '')

// The text of the first <tag>…</tag> in `block`: CDATA kept verbatim, everything else decoded.
// Atom `type="html"`/`"xhtml"` titles carry markup; their tags are dropped.
const textOf = (block: string, tag: string) => {
  const match = block.match(new RegExp(`<${tag}(\\s[^>]*)?>(${CONTENT})</${tag}\\s*>`))
  if (!match) return undefined
  const isMarkup = /\stype\s*=\s*["'](x?html)["']/.test(match[1] ?? '')
  const text = (match[2] ?? '').replace(
    /<!\[CDATA\[([\s\S]*?)\]\]>|([^<]+)|(<)/g,
    (_, cdata, plain, bracket) => cdata ?? (plain !== undefined ? decodeEntities(plain) : bracket),
  )

  // Markup titles are escaped HTML: drop the tags, then decode the HTML's own entities.
  return (isMarkup ? decodeEntities(text.replace(/<[^>]*>/g, '')) : text).trim()
}

const attrOf = (tag: string, name: string) => {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`))
  return match ? decodeEntities(match[2] ?? '') : undefined
}

// Atom: the rel="alternate" link (or the one with no rel); RSS: <link>url</link>. Links inside
// CDATA (a description's HTML) never count.
const linkOf = (block: string) => {
  const bare = withoutCdata(block)
  const hrefs = (bare.match(/<link\b[^>]*\/?>/g) ?? [])
    .map(tag => ({ rel: attrOf(tag, 'rel'), href: attrOf(tag, 'href') }))
    .filter(link => link.href !== undefined)
  const alternate = hrefs.find(link => link.rel === undefined || link.rel === 'alternate')
  if (alternate?.href) return alternate.href

  return textOf(bare, 'link') ?? ''
}

const isoDate = (value: string | undefined) => {
  const time = value ? Date.parse(value) : Number.NaN
  return Number.isNaN(time) ? '' : new Date(time).toISOString()
}

// C0/C1 controls (refused by the engine) and bidi overrides/isolates (could visually reverse a
// label next to a link whose href the terminal hides).
const isControl = (char: string) => {
  const code = char.codePointAt(0) ?? 0
  return (
    code < 0x20 ||
    (code >= 0x7f && code <= 0x9f) ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2066 && code <= 0x2069)
  )
}

/** Drawable text: control characters become spaces, whitespace collapsed. */
export const cleanText = (text: string) =>
  Array.from(text, char => (isControl(char) ? ' ' : char))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * The href a `Link` may carry, or undefined: the engine refuses the whole drawing for a link that
 * is not https, not printable ASCII, or not in canonical form, and feeds do carry `http:` links.
 * `new URL().href` percent-encodes and lowercases the host, which is the canonical form.
 */
export const safeHref = (raw: string) => {
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' && url.href.length <= 2048 ? url.href : undefined
  } catch {
    return undefined
  }
}

export const parseFeed = (xml: string, source: FeedSource): NewsItem[] => {
  const blocks = xml.match(new RegExp(`<(item|entry)(?:\\s[^>]*)?>${CONTENT}</\\1\\s*>`, 'g'))

  return (blocks ?? []).map(block => ({
    title: cleanText(textOf(block, 'title') ?? '') || 'Untitled',
    url: linkOf(block).trim(),
    source: source.name,
    icon: source.icon,
    published_at: isoDate(
      textOf(block, 'pubDate') ||
        textOf(block, 'published') ||
        textOf(block, 'updated') ||
        textOf(block, 'dc:date'),
    ),
  }))
}

const timeOf = (item: NewsItem) => {
  const time = Date.parse(item.published_at)
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time
}

/** Every feed's items, newest first (undated last), one per URL, capped at `max`. */
export const mergeItems = (lists: readonly NewsItem[][], max = MAX_ITEMS) => {
  const seen = new Set<string>()

  return lists
    .flat()
    .sort((a, b) => timeOf(b) - timeOf(a))
    .filter(item => {
      if (item.url === '') return true
      if (seen.has(item.url)) return false
      seen.add(item.url)
      return true
    })
    .slice(0, max)
}

/** The cards shown from `index`, wrapping around, never repeating an item. */
export const visibleWindow = (items: readonly NewsItem[], index: number) => {
  if (items.length === 0) return []
  const start = ((index % items.length) + items.length) % items.length
  const count = Math.min(VISIBLE_CARDS, items.length)

  return items.slice(start).concat(items.slice(0, start)).slice(0, count)
}

/** "just now", "5m", "3h", "2d" — the Tauri NewsCard's format; "" when undated. */
export const timeAgo = (publishedAt: string, now: number) => {
  const time = Date.parse(publishedAt)
  if (Number.isNaN(time)) return ''
  const minutes = Math.floor((now - time) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`

  return `${Math.floor(hours / 24)}d`
}

// --- Cache policy (S8). register.tsx does the I/O; `$` never crosses an import (validate rule).

// Legacy cache_ttl_minutes default.
export const CACHE_TTL_MS = 30 * 60_000
// With nothing to show, a failed round is retried sooner than the TTL (a laptop waking offline
// would otherwise sit on "No news" for half an hour).
export const EMPTY_RETRY_MS = 60_000
// A source that neither answers nor fails counts as failed after this long.
export const FETCH_TIMEOUT_MS = 10_000

/** What $.store keeps per language: the last good items and when the network was last tried. */
export type FeedCache = { items: NewsItem[]; checkedAt: number; isOffline: boolean }

export const cacheKey = (language: Language) => `feed:${language}`

const isNewsItem = (value: unknown): value is NewsItem => {
  const item = value as Record<string, unknown> | null
  return (
    typeof item === 'object' &&
    item !== null &&
    ['title', 'url', 'source', 'icon', 'published_at'].every(key => typeof item[key] === 'string')
  )
}

/** A stored cache, keeping only well-formed items (an older shape drops out); else undefined. */
export const asFeedCache = (value: unknown): FeedCache | undefined => {
  const cache = value as Partial<FeedCache> | null | undefined
  if (!cache || !Array.isArray(cache.items) || typeof cache.checkedAt !== 'number') return undefined

  return {
    items: mergeItems([cache.items.filter(isNewsItem)]),
    checkedAt: cache.checkedAt,
    isOffline: cache.isOffline === true,
  }
}

/**
 * Within the TTL the cache answers, even after a failed fetch: no retry before it expires (S8).
 * An empty cache expires after EMPTY_RETRY_MS; a stamp from the future (a clock set back) never
 * counts as fresh.
 */
export const isFresh = (cache: FeedCache | undefined, now: number): cache is FeedCache => {
  if (cache === undefined) return false
  const age = now - cache.checkedAt
  const ttl = cache.items.length === 0 ? EMPTY_RETRY_MS : CACHE_TTL_MS

  return age >= 0 && age < ttl
}

/**
 * The next cache from one round of fetches (`undefined` per failed source: an error, a timeout,
 * a non-2xx, or a body that parses to nothing). A source failing alone is skipped; all of them
 * failing is offline, keeping the last good items.
 */
export const settleFetches = (
  lists: readonly (NewsItem[] | undefined)[],
  cached: FeedCache | undefined,
  now: number,
): FeedCache => {
  const fetched = lists.filter((list): list is NewsItem[] => list !== undefined && list.length > 0)
  const isOffline = fetched.length === 0

  return {
    items: isOffline ? (cached?.items ?? []) : mergeItems(fetched),
    checkedAt: now,
    isOffline,
  }
}
