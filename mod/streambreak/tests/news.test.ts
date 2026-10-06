import type { On } from 'claude-code'
import type { Engine, Plugin } from 'claude-code/testing'
import { expect, mock, test } from 'claude-code/testing'

import { GN_ATOM, HN_RSS, TC_RSS } from './fixtures'

const PANE = 'streambreak'
const ROTATION_MS = 15_000
const TTL_MS = 30 * 60_000
const SURFACES = ['terminal', 'desktop', 'mobile'] as const

const BODIES: Record<string, string> = {
  'https://hnrss.org/frontpage': HN_RSS,
  'https://techcrunch.com/feed/': TC_RSS,
  'https://news.hada.io/rss/news': GN_ATOM,
}

// The engine beneath the plugin: mocked clock and store, a network the test can cut, and a pane
// that is open and shown once /streambreak ran.
const engine = (on: On, store: Record<string, unknown> = {}) => {
  const clock = mock.clock(on, { now: Date.parse('2026-10-03T12:00:00Z') })
  mock.store(on, store)
  const fetched: string[] = []
  const bodies = { ...BODIES }
  const hung = new Set<string>()
  let isOnline = true
  let isOpen = false

  let latencyMs = 0

  on('http.fetch', async (_, e) => {
    fetched.push(e.url)
    if (latencyMs > 0) await clock.sleep(latencyMs)
    if (!isOnline) throw new Error('offline')
    if (hung.has(e.url)) return new Promise<never>(() => undefined)
    const body = bodies[e.url]
    return {
      value: { status: body ? 200 : 404, ok: body !== undefined, headers: {}, text: body ?? '' },
    }
  })
  on('ui.open', () => {
    isOpen = true
    return { value: { isPlaced: true } }
  })
  on('ui.close', () => {
    isOpen = false
    return { value: undefined }
  })
  on('ui.panes', () => ({
    value: isOpen
      ? [{ id: PANE, title: PANE, isShown: true, isFocused: false, isPlaced: true }]
      : [],
  }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))

  return {
    clock,
    fetched,
    goOffline: () => {
      isOnline = false
    },
    setBody: (url: string, body: string) => {
      bodies[url] = body
    },
    hang: (url: string) => {
      hung.add(url)
    },
    setLatency: (ms: number) => {
      latencyMs = ms
    },
  }
}

const open = ($: Engine) =>
  $.command.run({
    command: 'streambreak',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 160 },
  })

const mount = ($: Engine, surface: (typeof SURFACES)[number] = 'terminal') =>
  $.ui.mount({
    plugin: 'streambreak',
    surface,
    component: 'Pane',
    requestId: PANE,
    props: {
      title: PANE,
      isFocused: false,
      bodyColumns: 80,
      placement: 'dock',
      scroll: { offset: 0, bodyRows: 30 },
      view: {},
    },
  })

const pressClose = async ($: Engine) => {
  const pane = await mount($)
  await pane.press({ key: 'close' })
  await pane.unmount()
}

const cardTitles = async (pane: Awaited<ReturnType<typeof mount>>) =>
  (await pane.findAll({ type: 'Link' })).map(link => String(link.props.label))

for (const surface of SURFACES) {
  test(`F5/F6 ${surface}: opening fetches the English feeds and draws newest-first cards`, async ($, on) => {
    const sim = engine(on)
    await open($)
    await sim.clock.settle()

    expect(sim.fetched.sort()).toEqual([
      'https://hnrss.org/frontpage',
      'https://techcrunch.com/feed/',
    ])
    const pane = await mount($, surface)
    const links = await pane.findAll({ type: 'Link' })
    // 4 items, 3 with a date: HN 04:53, TC 00:45... newest first; undated last.
    expect(links.map(link => link.props.href)).toEqual([
      'https://example.com/hn-1',
      'https://example.com/hn-2',
      'https://example.com/tc-1?a=1&b=2',
      'https://example.com/tc-2',
    ])
    expect(String(links[0]?.props.label)).toStartWith('🔥 Show HN')
    expect(await pane.find({ text: /Hacker News · 7h/ })).toBeDefined()
    await pane.unmount()
  })
}

test('F6: the cards rotate every 15 s while the pane is open', async ($, on) => {
  const sim = engine(on)
  await open($)
  await sim.clock.settle()
  const pane = await mount($)
  const first = await cardTitles(pane)

  await sim.clock.advance(ROTATION_MS - 1)
  expect(await cardTitles(pane)).toEqual(first)
  await sim.clock.advance(1)
  const second = await cardTitles(pane)
  expect(second[0]).toContain('Second story')
  expect(second).toHaveLength(4)
})

test('F5: within the TTL a reopen reads the cache; past it the network is asked again', async ($, on) => {
  const sim = engine(on)
  await open($)
  await sim.clock.settle()
  expect(sim.fetched).toHaveLength(2)

  await pressClose($)
  await open($)
  await sim.clock.settle()
  expect(sim.fetched).toHaveLength(2)

  await sim.clock.advance(TTL_MS)
  expect(sim.fetched).toHaveLength(4)
})

test('S8: offline with a cache keeps rotating the cache, says offline, no retry before the TTL', async ($, on) => {
  const sim = engine(on)
  await open($)
  await sim.clock.settle()
  sim.goOffline()
  await sim.clock.advance(TTL_MS) // the tick at the TTL tries the network and fails
  expect(sim.fetched).toHaveLength(4)

  const pane = await mount($)
  expect(await cardTitles(pane)).toHaveLength(4)
  expect(await pane.find({ text: /Offline/ })).toBeDefined()

  const attempts = sim.fetched.length
  await sim.clock.advance(TTL_MS - ROTATION_MS * 2)
  expect(sim.fetched).toHaveLength(attempts)
})

test('S8: offline with no cache says the news could not load, not that there is none', async ($, on) => {
  const sim = engine(on)
  sim.goOffline()
  await open($)
  await sim.clock.settle()

  const pane = await mount($)
  expect(await pane.findAll({ type: 'Link' })).toHaveLength(0)
  expect(await pane.find({ text: /couldn’t load news/ })).toBeDefined()
  expect(await pane.find({ text: /No news yet/ })).toBeUndefined()
  expect(await pane.find({ text: /saved news/ })).toBeUndefined() // one offline line, not two
})

test('F5: a cache from an earlier session answers without the network', async ($, on) => {
  const now = Date.parse('2026-10-03T12:00:00Z')
  const items = [
    {
      title: 'Cached',
      url: 'https://example.com/c',
      source: 'Hacker News',
      icon: '🔥',
      published_at: '',
    },
  ]
  const sim = engine(on, { 'feed:en': { items, checkedAt: now - 60_000, isOffline: false } })
  await open($)
  await sim.clock.settle()

  expect(sim.fetched).toHaveLength(0)
  const pane = await mount($)
  expect(await cardTitles(pane)).toEqual(['🔥 Cached'])
})

test('S9: closing the pane stops the rotation and its refreshes', async ($, on) => {
  const sim = engine(on)
  await open($)
  await sim.clock.settle()
  await pressClose($)
  await sim.clock.advance(TTL_MS + ROTATION_MS * 2)

  expect(sim.fetched).toHaveLength(2)
})

test('F6: new items after a refresh start the rotation from the top', async ($, on) => {
  const sim = engine(on)
  await open($)
  await sim.clock.settle()
  await sim.clock.advance(ROTATION_MS * 2)
  sim.setBody(
    'https://hnrss.org/frontpage',
    HN_RSS.replace(
      '<item>',
      // Three new items make 7: index 120 at the TTL tick would not wrap back to the top by itself.
      ['11', '10', '09']
        .map(
          (hour, n) =>
            `<item><title>${n === 0 ? 'Fresh headline' : `Fresh ${n}`}</title><link>https://example.com/fresh-${n}</link><pubDate>Sat, 03 Oct 2026 ${hour}:00:00 +0000</pubDate></item>`,
        )
        .join('')
        .concat('<item>'),
    ),
  )
  await sim.clock.advance(TTL_MS - ROTATION_MS * 2)

  const pane = await mount($)
  expect((await cardTitles(pane))[0]).toBe('🔥 Fresh headline')
})

// Same as lifecycle.test.ts: refuses clock waits armed before the latest session.start, so a
// second session.start behaves like a reload that dropped the module's timers.
const reloader: Plugin = {
  name: 'reloader',
  tier: 'prepend',
  register(on) {
    let epoch = 0
    on('session.start', (_, e, next) => {
      epoch += 1
      return next(e)
    })
    on('clock.every', async (_, e, next) => {
      const armedIn = epoch
      const fired = await next(e)
      return armedIn === epoch ? fired : { deny: 'module reloaded' }
    })
  },
}

const HOSTILE_HN = HN_RSS.replace(
  '<item>',
  [
    '<item><title>Plain http</title><link>http://insecure.example/x</link><pubDate>Sat, 03 Oct 2026 11:00:00 +0000</pubDate></item>',
    '<item><title>Hangul path</title><link>https://Example.com/wiki/한글 문서</link><pubDate>Sat, 03 Oct 2026 10:00:00 +0000</pubDate></item>',
    '<item><title>Bell &#7; and &#27;[31m escape</title><link>https://example.com/ctl</link><pubDate>Sat, 03 Oct 2026 09:00:00 +0000</pubDate></item>',
    '<item>',
  ].join(''),
)

test('H1: hostile links and titles never get the pane refused, on any surface, at any rotation', async ($, on) => {
  const sim = engine(on)
  sim.setBody('https://hnrss.org/frontpage', HOSTILE_HN)
  await open($)
  await sim.clock.settle()

  for (let tick = 0; tick < 7; tick += 1) {
    for (const surface of SURFACES) {
      const pane = await mount($, surface)
      expect(
        (await pane.findAll({ type: 'Link' })).every(link =>
          String(link.props.href).startsWith('https://'),
        ),
      ).toBe(true)
      await pane.unmount()
    }
    await sim.clock.advance(ROTATION_MS)
  }
  const pane = await mount($)
  expect(await pane.find({ text: /Plain http/ })).toBeDefined()
  expect((await pane.findAll({ type: 'Link' })).map(link => link.props.href)).toContain(
    'https://example.com/wiki/%ED%95%9C%EA%B8%80%20%EB%AC%B8%EC%84%9C',
  )
})

test('M1: an HTML page answered with 200 keeps the last items and says offline', async ($, on) => {
  const sim = engine(on)
  await open($)
  await sim.clock.settle()
  sim.setBody('https://hnrss.org/frontpage', '<html><body>Sign in to Wi-Fi</body></html>')
  sim.setBody('https://techcrunch.com/feed/', '<html>maintenance</html>')
  await sim.clock.advance(TTL_MS)

  const pane = await mount($)
  expect(await cardTitles(pane)).toHaveLength(4)
  expect(await pane.find({ text: /Offline/ })).toBeDefined()
})

test('M3: a source that never answers is dropped after 10 s and later refreshes still run', async ($, on) => {
  const sim = engine(on)
  sim.hang('https://techcrunch.com/feed/')
  await open($)
  await sim.clock.advance(10_000)

  const pane = await mount($)
  expect((await pane.findAll({ type: 'Link' })).map(link => link.props.href)).toEqual([
    'https://example.com/hn-1',
    'https://example.com/hn-2',
  ])
  await pane.unmount()
  const before = sim.fetched.length
  await sim.clock.advance(TTL_MS)
  expect(sim.fetched.length).toBeGreaterThan(before)
})

test(
  'M4: a reload while the pane is open restarts the rotation',
  { plugins: [reloader] },
  async ($, on) => {
    const sim = engine(on)
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
    await open($)
    await sim.clock.settle()
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
    await sim.clock.advance(ROTATION_MS)

    const pane = await mount($)
    expect((await cardTitles(pane))[0]).toContain('Second story')
  },
)

test('M4: refreshes asked for together share one round of fetches', async ($, on) => {
  const sim = engine(on)
  sim.setLatency(2_000) // the second open lands while the first round is still on the wire
  await open($)
  await sim.clock.settle()
  await open($)
  await sim.clock.advance(2_000)

  expect(sim.fetched).toHaveLength(2)
})
