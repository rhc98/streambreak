import type { On } from 'claude-code'
import type { Engine, Plugin } from 'claude-code/testing'
import { expect, mock, test } from 'claude-code/testing'

import { boardColumns } from '../hooks/games/views'
import { glyphs, MINE_COLOR } from '../hooks/theme'

const ASCII = glyphs('terminal')

const PANE = 'streambreak'
const SURFACES = ['terminal', 'desktop', 'mobile', 'vscode'] as const
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

const mount = ($: Engine, surface: Surface = 'terminal', bodyColumns = 80) =>
  $.ui.mount({
    plugin: 'streambreak',
    surface,
    component: 'Pane',
    requestId: PANE,
    props: {
      title: PANE,
      isFocused: false,
      bodyColumns,
      placement: 'dock',
      scroll: { offset: 0, bodyRows: 40 },
      view: {},
    },
  })

type Pane = Awaited<ReturnType<typeof mount>>

// A board cell's key: memory:<i>, gomoku:<r>:<c>, mines:<r>:<c>. Cells are Buttons when they can
// be pressed and keyed Boxes around colored Text when not (D4), so both are collected.
const CELL = { memory: /^memory:\d+$/, gomoku: /^gomoku:\d+:\d+$/, mines: /^mines:\d+:\d+$/ }

const labels = async (pane: Pane, game: keyof typeof CELL) => {
  const found = [
    ...(await pane.findAll({ type: 'Button' })),
    ...(await pane.findAll({ type: 'Box' })),
  ].filter(one => CELL[game].test(one.key ?? ''))
  return new Map(found.map(one => [one.key as string, one.text.trim()]))
}

/** The props of the colored Text inside a keyed (non-pressable) cell. */
const cellText = async (pane: Pane, key: string) =>
  ((await pane.find({ key }))?.children[0] as { props: Record<string, unknown> } | undefined)?.props

/** How many cells of `game` are controls. */
const pressable = async (pane: Pane, game: keyof typeof CELL) =>
  (await pane.findAll({ type: 'Button' })).filter(one => CELL[game].test(one.key ?? '')).length

const openGame = async (
  $: Engine,
  game: 'memory' | 'gomoku' | 'minesweeper',
  surface: Surface = 'terminal',
) => {
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
    const seen = await labels(pane, 'memory')
    if (seen.get('memory:0') === seen.get(`memory:${index}`)) return index
    await clock.advance(FLIP_BACK_MS)
  }
  throw new Error('no partner')
}

for (const surface of SURFACES) {
  test(`V5 ${surface}: the games tab draws Memory and Gomoku and takes presses`, async ($, on) => {
    const sim = engine(on)
    const g = glyphs(surface)
    const pane = await openGame($, 'memory', surface)

    const cards = await labels(pane, 'memory')
    expect(cards.size).toBe(16)
    expect([...cards.values()].every(label => label === HIDDEN)).toBe(true)
    await pane.press({ key: 'memory:5' })
    expect((await labels(pane, 'memory')).get('memory:5')).not.toBe(HIDDEN)

    await pane.press({ key: 'game:gomoku' })
    expect((await labels(pane, 'gomoku')).size).toBe(81)
    expect(await pressable(pane, 'gomoku')).toBe(81)
    await pane.press({ key: 'gomoku:4:4' })
    const stones = [...(await labels(pane, 'gomoku')).values()]
    expect(stones.filter(stone => stone === g.stones[1])).toHaveLength(1)
    expect(stones.filter(stone => stone === g.stones[2])).toHaveLength(1)
    expect(await pressable(pane, 'gomoku')).toBe(79) // stones are no longer controls
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

  expect(['game:memory', 'game:minesweeper', 'game:gomoku']).toContain(picked)
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

  const after = await labels(pane, 'memory')
  expect(after.get('memory:0')).not.toBe(HIDDEN)
  expect(after.get(`memory:${partner}`)).toBe(after.get('memory:0'))
  await sim.clock.advance(FLIP_BACK_MS * 2)
  expect((await labels(pane, 'memory')).get('memory:0')).not.toBe(HIDDEN)
  expect([...(await labels(pane, 'memory')).values()].filter(l => l !== HIDDEN)).toHaveLength(2)
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
  expect(await pane.find({ text: /^Your move \(X\)$/ })).toBeDefined()
  await pane.press({ key: 'gomoku:4:4' })
  expect(await pane.find({ text: /^AI played [a-i][1-9] — your move \(X\)$/ })).toBeDefined()
  await pane.press({ key: 'game:memory' })
  await pane.press({ key: 'memory:3' })
  await pane.press({ key: 'game:gomoku' })
  expect(
    [...(await labels(pane, 'gomoku')).values()].filter(s => s !== ASCII.stones[0]),
  ).toHaveLength(2)

  await pane.press({ key: 'game:new' })
  expect([...(await labels(pane, 'gomoku')).values()].every(s => s === ASCII.stones[0])).toBe(true)
  await pane.press({ key: 'game:memory' })
  expect((await labels(pane, 'memory')).get('memory:3')).not.toBe(HIDDEN)
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
  expect(
    [...(await labels(pane, 'gomoku')).values()].filter(s => s !== ASCII.stones[0]),
  ).toHaveLength(2)
  expect(sim.closed).toHaveLength(0)
})

test('S10: /clear keeps the game board', async ($, on) => {
  engine(on)
  await $.session.start(start)
  const pane = await openGame($, 'gomoku')
  await pane.press({ key: 'gomoku:2:2' })
  await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } })

  expect(
    [...(await labels(pane, 'gomoku')).values()].filter(s => s !== ASCII.stones[0]),
  ).toHaveLength(2)
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
      const seen = await labels(pane, 'memory')
      if (seen.get('memory:0') !== seen.get(`memory:${other}`)) break
      await pane.press({ key: 'game:new' })
    }
    expect([...(await labels(pane, 'memory')).values()].filter(l => l !== HIDDEN)).toHaveLength(2)

    await $.session.start(start) // the reload: the flip-back timer is gone
    await sim.clock.advance(FLIP_BACK_MS * 2)
    expect([...(await labels(pane, 'memory')).values()].every(l => l === HIDDEN)).toBe(true)
  },
)

test('F8: a shown mismatch turns back by itself after 600 ms', async ($, on) => {
  const sim = engine(on)
  const pane = await openGame($, 'memory')
  for (let other = 1; other < 16; other += 1) {
    await pane.press({ key: 'memory:0' })
    await pane.press({ key: `memory:${other}` })
    const seen = await labels(pane, 'memory')
    if (seen.get('memory:0') !== seen.get(`memory:${other}`)) break
    await pane.press({ key: 'game:new' })
  }

  await sim.clock.advance(FLIP_BACK_MS - 1)
  expect([...(await labels(pane, 'memory')).values()].filter(l => l !== HIDDEN)).toHaveLength(2)
  await sim.clock.advance(1)
  expect([...(await labels(pane, 'memory')).values()].every(l => l === HIDDEN)).toBe(true)
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
    const seen = await labels(pane, 'memory')
    if (seen.get('memory:0') !== seen.get(`memory:${other}`)) return other
    await pane.press({ key: 'game:new' })
  }
  throw new Error('no mismatch')
}

const faceUp = async (pane: Pane) =>
  [...(await labels(pane, 'memory')).values()].filter(label => label !== HIDDEN).length

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

for (const surface of SURFACES) {
  test(`V5 ${surface}: Minesweeper opens a safe area first and flags in flag mode`, async ($, on) => {
    engine(on)
    const g = glyphs(surface)
    const pane = await openGame($, 'minesweeper', surface)
    expect(
      [...(await labels(pane, 'mines')).values()].filter(l => l === g.mineHidden),
    ).toHaveLength(64)
    expect(await pressable(pane, 'mines')).toBe(64)

    await pane.press({ key: 'mines:4:4' })
    const opened = await labels(pane, 'mines')
    // The 3×3 around the first open never holds a mine, so (4, 4) opens empty.
    expect(opened.get('mines:4:4')).toBe(g.mineEmpty.trim())
    expect(await cellText(pane, 'mines:4:4')).toMatchObject({ dimColor: true }) // drawn, not missing
    expect([...opened.values()].some(l => l === g.mine)).toBe(false)
    const shut = [...opened.values()].filter(l => l === g.mineHidden).length
    expect(shut).toBeLessThan(64)
    expect(await pressable(pane, 'mines')).toBe(shut) // open cells are Text now

    const hidden = [...opened.entries()].find(([, label]) => label === g.mineHidden)?.[0]
    expect(hidden).toBeDefined()
    await pane.press({ key: 'mines:mode' })
    await pane.press({ key: hidden as string })
    expect((await labels(pane, 'mines')).get(hidden as string)).toBe(g.mineFlag)
    expect(await pressable(pane, 'mines')).toBe(shut) // a flag stays a control, to unflag
    await pane.press({ key: hidden as string })
    expect((await labels(pane, 'mines')).get(hidden as string)).toBe(g.mineHidden)
  })
}

test('D4: open Minesweeper numbers carry their colors', async ($, on) => {
  engine(on)
  const pane = await openGame($, 'minesweeper')
  await pane.press({ key: 'mines:4:4' })

  const numbered = [...(await labels(pane, 'mines')).entries()].filter(([, l]) => /^[1-8]$/.test(l))
  expect(numbered.length).toBeGreaterThan(0)
  for (const [key, label] of numbered) {
    expect((await cellText(pane, key))?.color).toBe(MINE_COLOR[Number(label)])
  }
})

test('D4: a finished board is inert and offers a new game beside the result', async ($, on) => {
  engine(on)
  const pane = await openGame($, 'minesweeper')
  await pane.press({ key: 'mines:4:4' })
  // Open shut cells until the game ends either way (64 presses at most: each opens a cell or ends it).
  for (let press = 0; press < 64 && (await pressable(pane, 'mines')) > 0; press += 1) {
    const shut = (await pane.findAll({ type: 'Button' })).find(one =>
      CELL.mines.test(one.key ?? ''),
    )
    await pane.press({ key: shut?.key as string })
  }

  expect(await pressable(pane, 'mines')).toBe(0)
  expect(await pane.find({ key: 'mines:mode' })).toBeUndefined()
  await pane.press({ key: 'game:new:result' })
  expect(await pressable(pane, 'mines')).toBe(64)
})

test("D4: the AI's last stone is underlined, not inverted", async ($, on) => {
  engine(on)
  const pane = await openGame($, 'gomoku')
  await pane.press({ key: 'gomoku:4:4' })

  const status = await pane.find({ text: /^AI played [a-i][1-9]/ })
  const [, column, row] = /AI played ([a-i])([1-9])/.exec(status?.text ?? '') ?? []
  const key = `gomoku:${Number(row) - 1}:${'abcdefghi'.indexOf(column ?? '')}`
  const stone = await cellText(pane, key)
  expect(stone).toMatchObject({ underline: true, bold: true })
  expect(stone?.inverse).toBeUndefined()
  expect((await cellText(pane, 'gomoku:4:4'))?.underline).toBe(false)
})

for (const game of ['memory', 'minesweeper', 'gomoku'] as const) {
  for (const surface of ['terminal', 'desktop'] as const) {
    test(`D4 ${surface}: ${game} draws at exactly its width and asks for room one column below`, async ($, on) => {
      engine(on)
      await open($)
      const width = boardColumns(game, glyphs(surface))
      const draws = async (columns: number) => {
        const pane = await mount($, surface, columns)
        await pane.press({ key: 'tab:games' })
        await pane.press({ key: `game:${game}` })
        const asks = (await pane.find({ text: /Widen the pane/ })) !== undefined
        await pane.unmount()
        return !asks
      }

      expect(await draws(width)).toBe(true)
      expect(await draws(width - 1)).toBe(false)
    })
  }
}

test('D6: off the terminal every board cell sits in a fixed, centered slot', async ($, on) => {
  engine(on)
  const pane = await openGame($, 'minesweeper', 'desktop')
  const width = glyphs('desktop').cellWidth
  expect((await pane.find({ key: 'mines:0:0:slot' }))?.props).toMatchObject({
    width,
    justifyContent: 'center',
  })
  await pane.press({ key: 'mines:4:4' })
  expect((await pane.find({ key: 'mines:4:4' }))?.props).toMatchObject({ width })

  await pane.press({ key: 'game:gomoku' })
  for (const key of ['gomoku:col:a', 'gomoku:4:4:slot']) {
    expect((await pane.find({ key }))?.props).toMatchObject({ width, justifyContent: 'center' })
  }
  await pane.unmount()

  const terminal = await openGame($, 'minesweeper')
  expect(await terminal.find({ key: 'mines:0:0:slot' })).toBeUndefined() // the grid aligns there
})

test('D6: the narrowest pane each board fits, per surface', () => {
  const terminal = glyphs('terminal')
  const desktop = glyphs('desktop')
  expect(
    ['memory', 'minesweeper', 'gomoku'].map(game => boardColumns(game as never, terminal)),
  ).toEqual([31, 19, 24])
  expect(
    ['memory', 'minesweeper', 'gomoku'].map(game => boardColumns(game as never, desktop)),
  ).toEqual([31, 28, 34])
})

test('D4: a finished Memory or Gomoku game offers a new game, and Gomoku goes inert', async ($, on) => {
  const sim = engine(on)
  const pane = await openGame($, 'memory')
  const isMatched = async (key: string) =>
    (await pane.findAll({ type: 'Button' })).find(one => one.key === key)?.props.dimColor === true
  // Pair every card by trying it against the others; 600 ms turns a mismatch back.
  for (let i = 0; i < 16; i += 1) {
    for (let j = i + 1; j < 16 && !(await isMatched(`memory:${i}`)); j += 1) {
      if (await isMatched(`memory:${j}`)) continue
      await pane.press({ key: `memory:${i}` })
      await pane.press({ key: `memory:${j}` })
      if (!(await isMatched(`memory:${i}`))) await sim.clock.advance(FLIP_BACK_MS)
    }
  }
  expect(await pane.find({ text: /^All matched!/ })).toBeDefined()
  await pane.press({ key: 'game:new:result' })
  expect(await faceUp(pane)).toBe(0)

  await pane.press({ key: 'game:gomoku' })
  // Play the first empty point until the game ends (each turn fills two points).
  for (let move = 0; move < 41 && (await pressable(pane, 'gomoku')) > 0; move += 1) {
    const point = (await pane.findAll({ type: 'Button' })).find(one =>
      CELL.gomoku.test(one.key ?? ''),
    )
    await pane.press({ key: point?.key as string })
  }
  expect(await pressable(pane, 'gomoku')).toBe(0)
  await pane.press({ key: 'game:new:result' })
  expect(await pressable(pane, 'gomoku')).toBe(81)
})
