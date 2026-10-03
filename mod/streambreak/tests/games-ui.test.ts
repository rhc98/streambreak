import type { On } from 'claude-code'
import type { Engine, Plugin } from 'claude-code/testing'
import { expect, mock, test } from 'claude-code/testing'

const PANE = 'streambreak'
const SURFACES = ['terminal', 'desktop', 'mobile'] as const
const FLIP_BACK_MS = 600
const HIDDEN = '❓'

type Surface = (typeof SURFACES)[number]

// The engine beneath the plugin: mocked clock and store, no network, and a pane that is open,
// shown and (optionally) holding the keyboard once /streambreak ran.
const engine = (on: On) => {
  const clock = mock.clock(on, { now: 5_000_000 })
  mock.store(on)
  let isOpen = false
  let isFocused = false
  let invalidations = 0
  const closed: string[] = []

  on('http.fetch', () => {
    throw new Error('offline')
  })
  on('ui.open', () => {
    isOpen = true
    return { value: { isPlaced: true } }
  })
  on('ui.close', (_, e) => {
    isOpen = false
    closed.push(e.id)
    return { value: undefined }
  })
  on('ui.panes', () => ({
    value: isOpen ? [{ id: PANE, title: PANE, isShown: true, isFocused, isPlaced: true }] : [],
  }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
  on('ui.invalidate', () => {
    invalidations += 1
    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))

  return {
    clock,
    closed,
    focus: (value: boolean) => {
      isFocused = value
    },
    invalidations: () => invalidations,
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

const mount = ($: Engine, surface: Surface = 'terminal') =>
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
      scroll: { offset: 0, bodyRows: 40 },
      view: {},
    },
  })

type Pane = Awaited<ReturnType<typeof mount>>

const labels = async (pane: Pane, prefix: string) => {
  const buttons = await pane.findAll({ type: 'Button' })
  return new Map(
    buttons.filter(b => b.key?.startsWith(prefix)).map(b => [b.key as string, b.text.trim()]),
  )
}

const openGame = async ($: Engine, game: 'memory' | 'gomoku', surface: Surface = 'terminal') => {
  await open($)
  const pane = await mount($, surface)
  await pane.press({ key: 'tab:games' })
  await pane.press({ key: `game:${game}` })
  return pane
}

// Turns cards over two at a time until it learns where card 0's partner is.
const findPartner = async (pane: Pane, clock: ReturnType<typeof engine>['clock']) => {
  for (let index = 1; index < 16; index += 1) {
    await pane.press({ key: 'memory:0' })
    await pane.press({ key: `memory:${index}` })
    const seen = await labels(pane, 'memory:')
    if (seen.get('memory:0') === seen.get(`memory:${index}`)) return index
    await clock.advance(FLIP_BACK_MS)
  }
  throw new Error('no partner')
}

for (const surface of SURFACES) {
  test(`V5 ${surface}: the games tab draws Memory and Gomoku and takes presses`, async ($, on) => {
    const sim = engine(on)
    const pane = await openGame($, 'memory', surface)

    const cards = await labels(pane, 'memory:')
    expect(cards.size).toBe(16)
    expect([...cards.values()].every(label => label === HIDDEN)).toBe(true)
    await pane.press({ key: 'memory:5' })
    expect((await labels(pane, 'memory:')).get('memory:5')).not.toBe(HIDDEN)

    await pane.press({ key: 'game:gomoku' })
    expect((await labels(pane, 'gomoku:')).size).toBe(81)
    await pane.press({ key: 'gomoku:4:4' })
    const stones = [...(await labels(pane, 'gomoku:')).values()]
    expect(stones.filter(stone => stone === 'X')).toHaveLength(1)
    expect(stones.filter(stone => stone === 'O')).toHaveLength(1)
    await sim.clock.settle()
  })
}

test('F11: the games tab opens on a game the first time and keeps it', async ($, on) => {
  engine(on)
  await open($)
  const pane = await mount($)
  await pane.press({ key: 'tab:games' })
  const picked = (await pane.findAll({ type: 'Button' })).find(
    b => b.key?.startsWith('game:') && b.props.variant === 'primary',
  )?.key

  expect(['game:memory', 'game:gomoku']).toContain(picked)
  await pane.press({ key: 'tab:news' })
  await pane.press({ key: 'tab:games' })
  expect((await pane.findAll({ type: 'Button' })).find(b => b.key === picked)?.props.variant).toBe(
    'primary',
  )
})

test('F8: a mismatch turns back after 600 ms; a match stays up', async ($, on) => {
  const sim = engine(on)
  const pane = await openGame($, 'memory')
  const partner = await findPartner(pane, sim.clock)

  const after = await labels(pane, 'memory:')
  expect(after.get('memory:0')).not.toBe(HIDDEN)
  expect(after.get(`memory:${partner}`)).toBe(after.get('memory:0'))
  await sim.clock.advance(FLIP_BACK_MS * 2)
  expect((await labels(pane, 'memory:')).get('memory:0')).not.toBe(HIDDEN)
  expect([...(await labels(pane, 'memory:')).values()].filter(l => l !== HIDDEN)).toHaveLength(2)
})

test('F8: the clock shows the seconds played', async ($, on) => {
  const sim = engine(on)
  const pane = await openGame($, 'memory')
  await pane.press({ key: 'memory:0' })
  await sim.clock.advance(3_000)
  await pane.redraw()

  expect(await pane.find({ text: /Moves 0 · 3s/ })).toBeDefined()
})

test('F11: New game deals a fresh deck; switching games keeps each board', async ($, on) => {
  engine(on)
  const pane = await openGame($, 'gomoku')
  await pane.press({ key: 'gomoku:4:4' })
  await pane.press({ key: 'game:memory' })
  await pane.press({ key: 'memory:3' })
  await pane.press({ key: 'game:gomoku' })
  expect([...(await labels(pane, 'gomoku:')).values()].filter(s => s !== '+')).toHaveLength(2)

  await pane.press({ key: 'game:new' })
  expect([...(await labels(pane, 'gomoku:')).values()].every(s => s === '+')).toBe(true)
  await pane.press({ key: 'game:memory' })
  expect((await labels(pane, 'memory:')).get('memory:3')).not.toBe(HIDDEN)
})

test('S1: a turn ending mid-game shows the banner over the board and keeps the pane while focused', async ($, on) => {
  const sim = engine(on)
  await $.session.start(start)
  const pane = await openGame($, 'gomoku')
  await pane.press({ key: 'gomoku:4:4' })
  sim.focus(true)
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.turn.complete({
    answer: 'ok',
    durationMs: 1,
    isAborted: false,
    turnId: 't1',
    reason: 'answer',
  })
  await sim.clock.advance(3_000 * 3)

  expect(await pane.find({ key: 'banner' })).toBeDefined()
  expect([...(await labels(pane, 'gomoku:')).values()].filter(s => s !== '+')).toHaveLength(2)
  expect(sim.closed).toHaveLength(0)
})

test('S10: /clear keeps the game board', async ($, on) => {
  engine(on)
  await $.session.start(start)
  const pane = await openGame($, 'gomoku')
  await pane.press({ key: 'gomoku:2:2' })
  await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } })

  expect([...(await labels(pane, 'gomoku:')).values()].filter(s => s !== '+')).toHaveLength(2)
})

// Refuses clock waits armed before the latest session.start: a reload that dropped the timers.
const reloader: Plugin = {
  name: 'reloader',
  tier: 'prepend',
  register(on) {
    let epoch = 0
    on('session.start', (_, e, next) => {
      epoch += 1
      return next(e)
    })
    on('clock.after', async (_, e, next) => {
      const armedIn = epoch
      const fired = await next(e)
      return armedIn === epoch ? fired : { deny: 'module reloaded' }
    })
  },
}

test(
  'S9: a reload while a mismatch waits turns it back instead of leaving it stuck',
  { plugins: [reloader] },
  async ($, on) => {
    const sim = engine(on)
    await $.session.start(start)
    const pane = await openGame($, 'memory')
    // Two cards whose symbols differ: reveal 0, then try others until one differs.
    let other = 1
    for (; other < 16; other += 1) {
      await pane.press({ key: 'memory:0' })
      await pane.press({ key: `memory:${other}` })
      const seen = await labels(pane, 'memory:')
      if (seen.get('memory:0') !== seen.get(`memory:${other}`)) break
      await pane.press({ key: 'game:new' })
    }
    expect([...(await labels(pane, 'memory:')).values()].filter(l => l !== HIDDEN)).toHaveLength(2)

    await $.session.start(start) // the reload: the flip-back timer is gone
    await sim.clock.advance(FLIP_BACK_MS * 2)
    expect([...(await labels(pane, 'memory:')).values()].every(l => l === HIDDEN)).toBe(true)
  },
)

test('F8: a shown mismatch turns back by itself after 600 ms', async ($, on) => {
  const sim = engine(on)
  const pane = await openGame($, 'memory')
  for (let other = 1; other < 16; other += 1) {
    await pane.press({ key: 'memory:0' })
    await pane.press({ key: `memory:${other}` })
    const seen = await labels(pane, 'memory:')
    if (seen.get('memory:0') !== seen.get(`memory:${other}`)) break
    await pane.press({ key: 'game:new' })
  }

  await sim.clock.advance(FLIP_BACK_MS - 1)
  expect([...(await labels(pane, 'memory:')).values()].filter(l => l !== HIDDEN)).toHaveLength(2)
  await sim.clock.advance(1)
  expect([...(await labels(pane, 'memory:')).values()].every(l => l === HIDDEN)).toBe(true)
})

test('S9: the Memory clock ticks only while a game runs in an open pane', async ($, on) => {
  const sim = engine(on)
  const pane = await openGame($, 'memory')
  await sim.clock.advance(3_000)
  expect(sim.invalidations()).toBe(0) // not started yet

  await pane.press({ key: 'memory:0' })
  await sim.clock.advance(3_000)
  expect(sim.invalidations()).toBe(3)

  await pane.press({ key: 'tab:news' })
  await sim.clock.advance(3_000)
  expect(sim.invalidations()).toBe(3)

  await pane.press({ key: 'tab:games' })
  await sim.clock.advance(1_000)
  expect(sim.invalidations()).toBe(4)
  await pane.press({ key: 'close' })
  await sim.clock.advance(3_000)
  expect(sim.invalidations()).toBe(4)
})

// Shows a mismatched pair (card 0 and another), dealing again until card 1+ differs from card 0.
const showMismatch = async (pane: Pane) => {
  for (let other = 1; other < 16; other += 1) {
    await pane.press({ key: 'memory:0' })
    await pane.press({ key: `memory:${other}` })
    const seen = await labels(pane, 'memory:')
    if (seen.get('memory:0') !== seen.get(`memory:${other}`)) return other
    await pane.press({ key: 'game:new' })
  }
  throw new Error('no mismatch')
}

const faceUp = async (pane: Pane) =>
  [...(await labels(pane, 'memory:')).values()].filter(label => label !== HIDDEN).length

const ROUND_TRIPS: Record<string, (pane: Pane) => Promise<void>> = {
  'the active Games tab': async pane => {
    await pane.press({ key: 'tab:games' })
  },
  'the active Memory button': async pane => {
    await pane.press({ key: 'game:memory' })
  },
  'a news → games round trip': async pane => {
    await pane.press({ key: 'tab:news' })
    await pane.press({ key: 'tab:games' })
  },
}

for (const [name, press] of Object.entries(ROUND_TRIPS)) {
  test(`S9: pressing ${name} during a pending mismatch still turns it back`, async ($, on) => {
    const sim = engine(on)
    const pane = await openGame($, 'memory')
    await showMismatch(pane)
    await sim.clock.advance(200)
    await press(pane)
    await sim.clock.advance(400)

    expect(await faceUp(pane)).toBe(0)
  })
}

test('S9: reopening the pane turns a pending mismatch back at once', async ($, on) => {
  engine(on)
  const pane = await openGame($, 'memory')
  await showMismatch(pane)
  await open($)

  expect(await faceUp(pane)).toBe(0)
})

// The `moves` token in flipCard's timer guards overlapping presses, which the kit runs one at a
// time; here the newer flip's cancel() is what protects the pair. This pins the visible rule.
test('F8: re-flipping the same pair gives it a full 600 ms again', async ($, on) => {
  const sim = engine(on)
  const pane = await openGame($, 'memory')
  const other = await showMismatch(pane)
  await sim.clock.advance(400)
  await pane.press({ key: 'memory:0' }) // settles the first mismatch, turns 0 up
  await pane.press({ key: `memory:${other}` }) // the same pair, mismatched again

  await sim.clock.advance(200) // the first timer's time
  expect(await faceUp(pane)).toBe(2)
  await sim.clock.advance(400)
  expect(await faceUp(pane)).toBe(0)
})
