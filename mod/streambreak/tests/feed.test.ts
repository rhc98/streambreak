import { expect, test } from 'claude-code/testing'

import {
  asFeedCache,
  CACHE_TTL_MS,
  cleanText,
  decodeEntities,
  EMPTY_RETRY_MS,
  FEEDS,
  isFresh,
  mergeItems,
  parseFeed,
  safeHref,
  settleFetches,
  timeAgo,
  visibleWindow,
} from '../hooks/feed'
import type { NewsItem } from '../types'
import { GN_ATOM, HN_RSS, TC_RSS } from './fixtures'

type Source = (typeof FEEDS.en)[number]
const [hn, tc] = FEEDS.en as readonly [Source, Source]
const [gn] = FEEDS.ko as readonly [Source]

const item = (n: number, published_at = new Date(Date.UTC(2026, 9, 1, n)).toISOString()) =>
  ({
    title: `t${n}`,
    url: `https://example.com/${n}`,
    source: 's',
    icon: 'i',
    published_at,
  }) satisfies NewsItem

test('V3: RSS with CDATA titles (hnrss shape)', () => {
  const items = parseFeed(HN_RSS, hn)

  expect(items).toHaveLength(2)
  expect(items[0]).toEqual({
    title: 'Show HN: A tiny <b>parser</b> & friends',
    url: 'https://example.com/hn-1',
    source: 'Hacker News',
    icon: '🔥',
    published_at: '2026-10-03T04:53:57.000Z',
  })
})

test('V3: RSS with numeric entities and an undated item (TechCrunch shape)', () => {
  const items = parseFeed(TC_RSS, tc)

  expect(items[0]?.title).toBe('It’s a startup’s ‘big’ day & more…')
  expect(items[0]?.url).toBe('https://example.com/tc-1?a=1&b=2')
  expect(items[0]?.published_at).toBe('2026-10-03T00:45:39.000Z')
  expect(items[1]?.published_at).toBe('')
})

test('V3: Atom entries, alternate links and offsets (GeekNews shape)', () => {
  const items = parseFeed(GN_ATOM, gn)

  expect(items).toHaveLength(2)
  expect(items[0]).toMatchObject({
    title: '한글 제목 테스트',
    url: 'https://example.com/gn-1',
    source: 'GeekNews',
    published_at: '2026-10-03T07:32:55.000Z',
  })
  expect(items[1]).toMatchObject({
    url: 'https://example.com/gn-2',
    published_at: '2026-10-02T00:00:00.000Z',
  })
})

test('V3: garbage in, nothing out', () => {
  expect(parseFeed('<html>not a feed</html>', hn)).toEqual([])
  expect(parseFeed('', hn)).toEqual([])
})

test('decodeEntities: named, decimal, hex; unknown left as is', () => {
  expect(decodeEntities('&amp;&lt;&gt;&quot;&apos;&#038;&#x2019;&bogus;')).toBe(`&<>"'&’&bogus;`)
})

test('V3: merge sorts newest first, undated last, capped at 10', () => {
  const merged = mergeItems([
    [item(1), item(5), item(0, '')],
    [item(3), ...Array.from({ length: 10 }, (_, n) => item(10 + n))],
  ])

  expect(merged).toHaveLength(10)
  expect(merged[0]?.title).toBe('t19')
  expect(merged.map(one => one.title)).not.toContain('t0')
  const all = mergeItems([[item(2), item(0, ''), item(4)]])
  expect(all.map(one => one.title)).toEqual(['t4', 't2', 't0'])
})

test('F6: the visible window wraps and never repeats an item', () => {
  const items = Array.from({ length: 7 }, (_, n) => item(n))

  expect(visibleWindow(items, 0).map(one => one.title)).toEqual(['t0', 't1', 't2', 't3', 't4'])
  expect(visibleWindow(items, 5).map(one => one.title)).toEqual(['t5', 't6', 't0', 't1', 't2'])
  expect(visibleWindow(items, 12).map(one => one.title)).toEqual(['t5', 't6', 't0', 't1', 't2'])
  expect(visibleWindow(items.slice(0, 3), 1).map(one => one.title)).toEqual(['t1', 't2', 't0'])
  expect(visibleWindow([], 4)).toEqual([])
})

test('timeAgo matches the Tauri NewsCard format', () => {
  const now = Date.parse('2026-10-03T12:00:00Z')

  expect(timeAgo('2026-10-03T11:59:30Z', now)).toBe('just now')
  expect(timeAgo('2026-10-03T11:15:00Z', now)).toBe('45m')
  expect(timeAgo('2026-10-03T07:00:00Z', now)).toBe('5h')
  expect(timeAgo('2026-09-30T12:00:00Z', now)).toBe('3d')
  expect(timeAgo('', now)).toBe('')
})

test('S8: one source failing is skipped; all failing keeps the last items, offline', () => {
  const cached = { items: [item(1)], checkedAt: 0, isOffline: false }

  expect(settleFetches([[item(2)], undefined], cached, 5)).toEqual({
    items: [item(2)],
    checkedAt: 5,
    isOffline: false,
  })
  expect(settleFetches([undefined, undefined], cached, 5)).toEqual({
    items: [item(1)],
    checkedAt: 5,
    isOffline: true,
  })
  expect(settleFetches([undefined], undefined, 5)).toEqual({
    items: [],
    checkedAt: 5,
    isOffline: true,
  })
})

test('S8: the cache answers until the TTL, failed or not', () => {
  const cache = { items: [item(1)], checkedAt: 1_000, isOffline: true }

  expect(isFresh(cache, 1_000 + CACHE_TTL_MS - 1)).toBe(true)
  expect(isFresh(cache, 1_000 + CACHE_TTL_MS)).toBe(false)
  expect(isFresh(undefined, 0)).toBe(false)
})

test('S8: an empty cache is retried after a minute; a future stamp is never fresh', () => {
  const empty = { items: [], checkedAt: 1_000, isOffline: true }

  expect(isFresh(empty, 1_000 + EMPTY_RETRY_MS - 1)).toBe(true)
  expect(isFresh(empty, 1_000 + EMPTY_RETRY_MS)).toBe(false)
  expect(isFresh({ items: [item(1)], checkedAt: 5_000, isOffline: false }, 1_000)).toBe(false)
})

test('M1: a source answering with nothing parseable counts as failed', () => {
  const cached = { items: [item(1)], checkedAt: 0, isOffline: false }

  expect(settleFetches([[], []], cached, 5)).toEqual({
    items: [item(1)],
    checkedAt: 5,
    isOffline: true,
  })
})

test('M2: a stored cache keeps only well-formed items', () => {
  const stored = {
    items: [item(1), { title: 'Old', link: 'x', publishedAt: '' }, null],
    checkedAt: 3,
  }

  expect(asFeedCache(stored)).toEqual({ items: [item(1)], checkedAt: 3, isOffline: false })
  expect(asFeedCache({ items: 'nope', checkedAt: 3 })).toBeUndefined()
  expect(asFeedCache(undefined)).toBeUndefined()
})

test('H1: only canonical https links reach a Link', () => {
  expect(safeHref('http://example.com/a')).toBeUndefined()
  expect(safeHref('javascript:alert(1)')).toBeUndefined()
  expect(safeHref('not a url')).toBeUndefined()
  expect(safeHref('https://Example.com/a')).toBe('https://example.com/a')
  expect(safeHref('https://example.com/wiki/한글')).toBe(
    'https://example.com/wiki/%ED%95%9C%EA%B8%80',
  )
  expect(safeHref('https://example.com/a b')).toBe('https://example.com/a%20b')
})

test('H1: titles lose control characters and extra whitespace', () => {
  expect(cleanText('a\u0001b\u001b[31m  c\n\td\u0085')).toBe('a b [31m c d')
})

test('parser: CDATA cannot end an item or supply its link; empty dates fall through', () => {
  const xml = `<rss><channel><item><title>Real</title><description><![CDATA[<p>see <link href="https://evil.example/">x</link></p></item>]]></description><pubDate></pubDate><updated>2026-10-01T00:00:00Z</updated><link>https://example.com/real</link></item></channel></rss>`
  const [only, ...rest] = parseFeed(xml, hn)

  expect(rest).toHaveLength(0)
  expect(only).toMatchObject({
    title: 'Real',
    url: 'https://example.com/real',
    published_at: '2026-10-01T00:00:00.000Z',
  })
})

test('parser: Atom html/xhtml titles drop their markup; CDATA titles keep theirs', () => {
  const atom = `<feed><entry><title type="html">A &lt;b&gt;bold&lt;/b&gt; claim</title><link href="https://example.com/1"/></entry><entry><title type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml">Plain <em>text</em></div></title><link href="https://example.com/2"/></entry></feed>`

  expect(parseFeed(atom, gn).map(one => one.title)).toEqual(['A bold claim', 'Plain text'])
  expect(parseFeed(HN_RSS, hn)[0]?.title).toBe('Show HN: A tiny <b>parser</b> & friends')
})

test('merge keeps one card per URL (the newest)', () => {
  const twice = { ...item(1), title: 'older copy' }
  const merged = mergeItems([
    [item(5, '2026-10-02T00:00:00.000Z')],
    [{ ...twice, url: item(5).url }],
  ])

  expect(merged).toHaveLength(1)
  expect(merged[0]?.title).toBe('t5')
})

test('parser: an unclosed item over many CDATA sections fails fast (no exponential backtracking)', () => {
  const sections = Array.from({ length: 40 }, (_, n) => `<x><![CDATA[part ${n} ]] ]]></x>`).join('')
  const xml = `<rss><channel><item><title><![CDATA[t]]></title>${sections}</channel></rss>`
  const started = Date.now()

  expect(parseFeed(xml, hn)).toEqual([])
  expect(Date.now() - started).toBeLessThan(200)
})

test('parser: closing tags may carry whitespace', () => {
  const xml = `<rss><channel><item ><title >Spaced</title ><link>https://example.com/s</link ></item ></channel></rss>`

  expect(parseFeed(xml, hn)).toMatchObject([{ title: 'Spaced', url: 'https://example.com/s' }])
})

test('parser: html titles decode their own entities after the markup goes', () => {
  const atom = `<feed><entry><title type="html">AT&amp;amp;T &lt;i&gt;says&lt;/i&gt;</title><link href="https://example.com/1"/></entry></feed>`

  expect(parseFeed(atom, gn)[0]?.title).toBe('AT&T says')
})

test('H1: bidi overrides and isolates are removed from labels', () => {
  expect(cleanText('a‮b⁦c⁩d')).toBe('a b c d')
})

test('M2: a stored cache is deduplicated like a fresh merge', () => {
  const stored = {
    items: [item(2), { ...item(1), url: item(2).url }],
    checkedAt: 3,
    isOffline: false,
  }

  expect(asFeedCache(stored)?.items).toEqual([item(2)])
})
