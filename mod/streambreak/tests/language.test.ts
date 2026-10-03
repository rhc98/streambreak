import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { expect, mock, test } from 'claude-code/testing'

import { GN_ATOM, HN_RSS, TC_RSS } from './fixtures'

const PANE = 'streambreak'
const BODIES: Record<string, string> = {
  'https://hnrss.org/frontpage': HN_RSS,
  'https://techcrunch.com/feed/': TC_RSS,
  'https://news.hada.io/rss/news': GN_ATOM,
}
const GEEKNEWS = 'https://news.hada.io/rss/news'

// `store: null` stands for a store that fails every call.
const engine = (on: On, store: Record<string, unknown> | null = {}) => {
  const clock = mock.clock(on, { now: Date.parse('2026-10-03T12:00:00Z') })
  if (store) {
    mock.store(on, store)
  } else {
    const down = () => {
      throw new Error('store unavailable')
    }
    on('store.get', down)
    on('store.set', down)
    on('store.delete', down)
  }
  const fetched: string[] = []
  const toasts: string[] = []
  let isOpen = false
  let latencyMs = 0

  on('http.fetch', async (_, e) => {
    fetched.push(e.url)
    if (latencyMs > 0) await clock.sleep(latencyMs)
    const body = BODIES[e.url] ?? ''
    return { value: { status: 200, ok: true, headers: {}, text: body } }
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
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.log', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))

  return {
    clock,
    fetched,
    toasts,
    setLatency: (ms: number) => {
      latencyMs = ms
    },
  }
}

const start = { cwd: '/repo', surface: 'terminal', isInteractive: true } as const

const open = ($: Engine) =>
  $.command.run({
    command: 'streambreak',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 160 },
  })

const mount = ($: Engine) =>
  $.ui.mount({
    plugin: 'streambreak',
    surface: 'terminal',
    component: 'Pane',
    requestId: PANE,
    props: {
      title: PANE,
      isFocused: false,
      bodyColumns: 80,
      placement: 'dock',
      scroll: { offset: 0, bodyRows: 40 },
      view: {},
    },
  })

const hrefs = async (pane: Awaited<ReturnType<typeof mount>>) =>
  (await pane.findAll({ type: 'Link' })).map(link => String(link.props.href))

test(
  'F12: threshold_seconds sets when the break toast comes',
  { options: { threshold_seconds: 3 } },
  async ($, on) => {
    const sim = engine(on)
    await $.session.start(start)
    await $.turn.start({ text: 'go', turnId: 't1' })
    await sim.clock.advance(2_999)
    expect(sim.toasts).toHaveLength(0)
    await sim.clock.advance(1)
    expect(sim.toasts).toEqual(['Break time — run /streambreak'])
  },
)

test(
  'F12: rotation_seconds sets the card rotation',
  { options: { rotation_seconds: 20 } },
  async ($, on) => {
    const sim = engine(on)
    await open($)
    await sim.clock.settle()
    const pane = await mount($)
    const first = (await hrefs(pane))[0]

    await sim.clock.advance(15_000)
    expect((await hrefs(pane))[0]).toBe(first)
    await sim.clock.advance(5_000)
    expect((await hrefs(pane))[0]).not.toBe(first)
  },
)

test(
  'F12/S6: language "ko" draws Korean and reads GeekNews',
  { options: { language: 'ko' } },
  async ($, on) => {
    const sim = engine(on)
    await $.session.start(start)
    await open($)
    await sim.clock.settle()
    const pane = await mount($)

    expect(sim.fetched).toEqual([GEEKNEWS])
    expect((await pane.find({ key: 'tab:news' }))?.text).toBe('뉴스')
    expect(await hrefs(pane)).toContain('https://example.com/gn-1')
  },
)

test('F13: the pane toggle switches language, refetches, restarts at the top and remembers it', async ($, on) => {
  const store: Record<string, unknown> = {}
  const sim = engine(on, store)
  await $.session.start(start)
  await open($)
  await sim.clock.settle()
  const pane = await mount($)
  await sim.clock.advance(15_000) // the cards have moved on

  await pane.press({ key: 'lang' })
  expect(sim.fetched).toContain(GEEKNEWS)
  expect((await pane.find({ key: 'tab:news' }))?.text).toBe('뉴스')
  expect((await hrefs(pane))[0]).toBe('https://example.com/gn-1')

  // A later load (new session, same store) keeps the override.
  await $.session.start(start)
  expect((await pane.find({ key: 'tab:news' }))?.text).toBe('뉴스')
})

test(
  'S6: a language changed in the settings since the toggle clears the override',
  { options: { language: 'ko' } },
  async ($, on) => {
    // The person toggled to English while the setting said English… then set Korean in the menu.
    const store: Record<string, unknown> = { language: 'en', 'config:language': 'en' }
    engine(on, store)
    await $.session.start(start)
    await open($)
    const pane = await mount($)
    expect((await pane.find({ key: 'tab:news' }))?.text).toBe('뉴스')

    // The next load must not bring the stale English override back.
    await $.session.start(start)
    expect((await pane.find({ key: 'tab:news' }))?.text).toBe('뉴스')
  },
)

test('S6: toggling while a refresh is on the wire still ends on the new language', async ($, on) => {
  const sim = engine(on)
  sim.setLatency(2_000)
  await $.session.start(start)
  await open($)
  await sim.clock.settle() // the English round is now in flight
  const pane = await mount($)
  await pane.press({ key: 'lang' })
  await sim.clock.advance(2_000) // the English round lands now: it must not be drawn
  expect(await hrefs(pane)).toEqual([])
  await sim.clock.advance(3_000)

  expect(await hrefs(pane)).toEqual(['https://example.com/gn-1', 'https://example.com/gn-2'])
})

test('F13: two quick presses flip twice and end where they began', async ($, on) => {
  engine(on)
  await $.session.start(start)
  await open($)
  const pane = await mount($)
  await Promise.all([pane.press({ key: 'lang' }), pane.press({ key: 'lang' })])

  expect((await pane.find({ key: 'tab:news' }))?.text).toBe('News')
})

test(
  'S6: with the store down, the language setting still applies',
  { options: { language: 'ko' } },
  async ($, on) => {
    engine(on, null)
    await $.session.start(start)
    await open($)
    const pane = await mount($)

    expect((await pane.find({ key: 'tab:news' }))?.text).toBe('뉴스')
  },
)

test(
  'F13: Korean cards say how long ago in Korean',
  { options: { language: 'ko' } },
  async ($, on) => {
    const sim = engine(on)
    await $.session.start(start)
    await open($)
    await sim.clock.settle()
    const pane = await mount($)

    expect(await pane.find({ text: /GeekNews · 4시간/ })).toBeDefined()
  },
)

test('F13: a reload while the toggled news still loads keeps the new language', async ($, on) => {
  const sim = engine(on)
  sim.setLatency(5_000)
  await $.session.start(start)
  await open($)
  await sim.clock.settle()
  const pane = await mount($)
  void pane.press({ key: 'lang' }) // the Korean round is now on the wire
  await sim.clock.advance(100)
  await $.session.start(start) // a reload before it lands

  expect((await pane.find({ key: 'tab:news' }))?.text).toBe('뉴스')
})
