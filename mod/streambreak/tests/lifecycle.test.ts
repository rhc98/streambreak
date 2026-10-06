import type { On, RenderSurface, UiPane } from 'claude-code'
import type { Engine, Plugin } from 'claude-code/testing'
import { expect, mock, test } from 'claude-code/testing'

const PANE = 'streambreak'
const THRESHOLD_MS = 10_000
const FADE_OUT_MS = 3_000

// The engine beneath the plugin: a mocked clock, a recorded toast line, and a pane list the
// test controls (open / shown / focused / placed), as a session's surfaces would report it.
// A reload drops every timer the old module armed, but the kit keeps one module instance. This
// plugin, loaded above streambreak, counts session.starts and refuses any clock.after armed
// before the latest one, so a "reload" here really leaves only what session.start re-arms.
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

const engine = ($: Engine, on: On) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  const toasts: string[] = []
  const closed: string[] = []
  let pane: UiPane | undefined

  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.log', () => ({ value: undefined }))
  let paneQueries = 0
  on('ui.panes', () => {
    paneQueries += 1
    return { value: pane ? [pane] : [] }
  })
  on('ui.close', (_, e) => {
    closed.push(e.id)
    pane = undefined
    return { value: undefined }
  })

  return {
    clock,
    toasts,
    closed,
    openPane: (overrides: Partial<UiPane> = {}) => {
      pane = {
        id: PANE,
        title: PANE,
        isShown: true,
        isFocused: false,
        isPlaced: true,
        ...overrides,
      }
    },
    paneQueries: () => paneQueries,
    /** A hot reload: old timers die (see `reloader`), $.state stays, session.start fires again. */
    reload: () => $.session.start(start),
  }
}

const start = { cwd: '/repo', surface: 'terminal', isInteractive: true } as const
const complete = (
  turnId: string,
  extra: { reason?: 'answer' | 'aborted' | 'error'; agentId?: string } = {},
) => ({
  answer: 'ok',
  durationMs: 1,
  isAborted: extra.reason === 'aborted',
  turnId,
  reason: extra.reason ?? ('answer' as const),
  ...(extra.agentId === undefined ? {} : { agentId: extra.agentId }),
})

const mountPane = ($: Engine, surface: RenderSurface = 'terminal') =>
  $.ui.mount({
    plugin: 'streambreak',
    surface,
    component: 'Pane',
    requestId: PANE,
    props: {
      title: PANE,
      isFocused: false,
      bodyColumns: 60,
      placement: 'dock',
      scroll: { offset: 0, bodyRows: 20 },
      view: {},
    },
  })

const bannerShown = async ($: Engine) => {
  const pane = await mountPane($)
  const banner = await pane.find({ key: 'banner' })
  await pane.unmount()

  return banner !== undefined
}

test('F3: a turn past the threshold offers one break toast', async ($, on) => {
  const sim = engine($, on)
  await $.session.start(start)
  await $.turn.start({ text: 'go', turnId: 't1' })

  await sim.clock.advance(THRESHOLD_MS - 1)
  expect(sim.toasts).toHaveLength(0)
  await sim.clock.advance(1)
  expect(sim.toasts).toHaveLength(1)
  await sim.clock.advance(THRESHOLD_MS * 3)
  expect(sim.toasts).toHaveLength(1)
})

test('F3: each new main turn gets its own offer', async ($, on) => {
  const sim = engine($, on)
  await $.session.start(start)
  await $.turn.start({ text: 'go', turnId: 't1' })
  await sim.clock.advance(THRESHOLD_MS)
  await $.turn.complete(complete('t1'))
  await $.turn.start({ text: 'again', turnId: 't2' })
  await sim.clock.advance(THRESHOLD_MS)

  expect(sim.toasts).toHaveLength(2)
})

test('S4: a turn completing before the threshold never toasts', async ($, on) => {
  const sim = engine($, on)
  await $.session.start(start)
  await $.turn.start({ text: 'go', turnId: 't1' })
  await sim.clock.advance(THRESHOLD_MS / 2)
  await $.turn.complete(complete('t1'))
  await sim.clock.advance(THRESHOLD_MS * 2)

  expect(sim.toasts).toHaveLength(0)
})

test('S4: an aborted turn with the pane open shows no banner and stays open', async ($, on) => {
  const sim = engine($, on)
  await $.session.start(start)
  sim.openPane()
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.turn.complete(complete('t1', { reason: 'aborted' }))
  await sim.clock.advance(FADE_OUT_MS * 2)

  expect(await bannerShown($)).toBe(false)
  expect(sim.closed).toHaveLength(0)
})

test('F7: a turn ending in an error shows no "finished" banner', async ($, on) => {
  const sim = engine($, on)
  await $.session.start(start)
  sim.openPane()
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.turn.complete(complete('t1', { reason: 'error' }))

  expect(await bannerShown($)).toBe(false)
  await sim.clock.advance(FADE_OUT_MS)
  expect(sim.closed).toHaveLength(0)
})

test('S3: a subagent turn.complete with the main turnId leaves the main turn running', async ($, on) => {
  const sim = engine($, on)
  await $.session.start(start)
  sim.openPane({ isShown: false })
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.turn.complete(complete('t1', { agentId: 'a1' }))

  expect(await bannerShown($)).toBe(false)
  await sim.clock.advance(THRESHOLD_MS)
  expect(sim.toasts).toHaveLength(1)
})

test('S2: no break toast while the pane is already shown', async ($, on) => {
  const sim = engine($, on)
  await $.session.start(start)
  sim.openPane()
  await $.turn.start({ text: 'go', turnId: 't1' })
  await sim.clock.advance(THRESHOLD_MS)

  expect(sim.toasts).toHaveLength(0)
})

test('F7: completion with the pane open shows the banner, then closes it', async ($, on) => {
  const sim = engine($, on)
  await $.session.start(start)
  sim.openPane()
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.turn.complete(complete('t1'))

  expect(await bannerShown($)).toBe(true)
  await sim.clock.advance(FADE_OUT_MS)
  expect(sim.closed).toEqual([PANE])
  expect(await bannerShown($)).toBe(false)
})

test('F7: completion with no pane open changes nothing on screen', async ($, on) => {
  const sim = engine($, on)
  await $.session.start(start)
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.turn.complete(complete('t1'))
  await sim.clock.advance(FADE_OUT_MS)

  expect(sim.closed).toHaveLength(0)
  expect(await bannerShown($)).toBe(false)
})

test('S5: an unplaced or background pane is never closed by the fade', async ($, on) => {
  const sim = engine($, on)
  await $.session.start(start)
  for (const hidden of [{ isPlaced: false }, { isShown: false }]) {
    sim.openPane(hidden)
    await $.turn.start({ text: 'go', turnId: 't1' })
    await $.turn.complete(complete('t1'))
    await sim.clock.advance(FADE_OUT_MS * 2)

    expect(sim.closed).toHaveLength(0)
    expect(await bannerShown($)).toBe(false)
  }
})

test('S1: a pane holding the keyboard stays until it lets go', async ($, on) => {
  const sim = engine($, on)
  await $.session.start(start)
  sim.openPane({ isFocused: true })
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.turn.complete(complete('t1'))
  await sim.clock.advance(FADE_OUT_MS * 3)

  expect(sim.closed).toHaveLength(0)
  expect(await bannerShown($)).toBe(true)

  sim.openPane({ isFocused: false })
  await sim.clock.advance(FADE_OUT_MS)
  expect(sim.closed).toEqual([PANE])
})

test('S2: a new turn takes the banner down before it fades', async ($, on) => {
  const sim = engine($, on)
  await $.session.start(start)
  sim.openPane()
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.turn.complete(complete('t1'))
  await $.turn.start({ text: 'again', turnId: 't2' })
  await sim.clock.advance(FADE_OUT_MS)

  expect(sim.closed).toHaveLength(0)
  expect(await bannerShown($)).toBe(false)
})

test(
  'S7: a reload mid-turn re-arms the break timer for the time left',
  { plugins: [reloader] },
  async ($, on) => {
    const sim = engine($, on)
    await $.session.start(start)
    await $.turn.start({ text: 'go', turnId: 't1' })
    await sim.clock.advance(4_000)
    await sim.reload()
    await sim.clock.advance(THRESHOLD_MS - 4_000 - 1)
    expect(sim.toasts).toHaveLength(0)
    await sim.clock.advance(1)

    expect(sim.toasts).toHaveLength(1)
  },
)

test(
  'S7: a reload while the banner shows re-arms the fade',
  { plugins: [reloader] },
  async ($, on) => {
    const sim = engine($, on)
    await $.session.start(start)
    sim.openPane()
    await $.turn.start({ text: 'go', turnId: 't1' })
    await $.turn.complete(complete('t1'))
    await sim.reload()
    await sim.clock.advance(FADE_OUT_MS)

    expect(sim.closed).toEqual([PANE])
  },
)

test('S10: /clear ends the session and drops the pending offer', async ($, on) => {
  const sim = engine($, on)
  await $.session.start(start)
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } })
  await sim.clock.advance(THRESHOLD_MS)

  expect(sim.toasts).toHaveLength(0)
})

test('S10: /clear while the banner shows takes it down and leaves the pane open', async ($, on) => {
  const sim = engine($, on)
  await $.session.start(start)
  sim.openPane()
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.turn.complete(complete('t1'))
  await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } })

  expect(await bannerShown($)).toBe(false)
  await sim.clock.advance(FADE_OUT_MS)
  expect(sim.closed).toHaveLength(0)
})

test('S5: a pane moved to a background tab during the fade is left open', async ($, on) => {
  const sim = engine($, on)
  await $.session.start(start)
  sim.openPane()
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.turn.complete(complete('t1'))
  sim.openPane({ isShown: false })
  await sim.clock.advance(FADE_OUT_MS)

  expect(sim.closed).toHaveLength(0)
  expect(await bannerShown($)).toBe(false)
})

test('F14: a permission dialog during a turn offers the break at once, and only once', async ($, on) => {
  const sim = engine($, on)
  on('classic.PermissionRequest', () => ({}))
  on('classic.Notification', () => ({}))
  await $.session.start(start)
  await $.turn.start({ text: 'go', turnId: 't1' })
  await sim.clock.advance(2_000)

  await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'rm -rf build' } })
  await sim.clock.settle()
  expect(sim.toasts).toHaveLength(1)

  await sim.clock.advance(THRESHOLD_MS) // the threshold timer was replaced by the early offer
  expect(sim.toasts).toHaveLength(1)
})

test('F14: a permission dialog with no turn running offers nothing', async ($, on) => {
  const sim = engine($, on)
  on('classic.PermissionRequest', () => ({}))
  await $.session.start(start)
  await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'ls' } })
  await sim.clock.settle()

  expect(sim.toasts).toHaveLength(0)
})

test('F14: a tool.check `ask` alone (auto mode, another plugin’s query) offers nothing', async ($, on) => {
  const sim = engine($, on)
  on('tool.check', () => ({ decision: 'ask' as const }))
  await $.session.start(start)
  await $.turn.start({ text: 'go', turnId: 't1' })
  expect((await $.tool.check({ tool: 'Bash', input: { command: 'ls' } })).decision).toBe('ask')
  await sim.clock.settle()

  expect(sim.toasts).toHaveLength(0)
})

test('F14: only a permission_prompt notification counts', async ($, on) => {
  const sim = engine($, on)
  on('classic.Notification', () => ({}))
  await $.session.start(start)
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.classic.Notification({ message: 'idle', notification_type: 'idle_prompt' })
  await sim.clock.settle()
  expect(sim.toasts).toHaveLength(0)

  await $.classic.Notification({
    message: 'Claude needs your permission',
    notification_type: 'permission_prompt',
  })
  await sim.clock.settle()
  expect(sim.toasts).toHaveLength(1)
})

test(
  'HIGH: a 0 ms fade-out never spins while the pane holds the keyboard',
  { options: { fade_out_delay_ms: 0 } },
  async ($, on) => {
    const sim = engine($, on)
    sim.openPane({ isFocused: true })
    await $.session.start(start)
    await $.turn.start({ text: 'go', turnId: 't1' })
    await $.turn.complete(complete('t1'))
    const before = sim.paneQueries()
    await sim.clock.advance(10_000)

    expect(sim.paneQueries() - before).toBeLessThanOrEqual(12)
    expect(sim.closed).toHaveLength(0)
  },
)

test('F14: the dialog and its notification together still offer once', async ($, on) => {
  const sim = engine($, on)
  on('classic.PermissionRequest', () => ({}))
  on('classic.Notification', () => ({}))
  await $.session.start(start)
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'rm -rf build' } })
  await $.classic.Notification({
    message: 'Claude needs your permission',
    notification_type: 'permission_prompt',
  })
  await sim.clock.settle()

  expect(sim.toasts).toHaveLength(1)
})

test('F17: the pane says Claude is working only while a main turn runs', async ($, on) => {
  const sim = engine($, on)
  await $.session.start(start)
  const working = async () => {
    const pane = await mountPane($)
    const line = await pane.find({ text: /Claude is working/ })
    await pane.unmount()
    return line !== undefined
  }

  expect(await working()).toBe(false)
  await $.turn.start({ text: 'go', turnId: 't1' })
  expect(await working()).toBe(true)
  await sim.clock.advance(THRESHOLD_MS) // still running after the break offer
  expect(await working()).toBe(true)
  await $.turn.complete(complete('t1'))
  expect(await working()).toBe(false)
})

test('D3: the status row is always one row, so a phase change never moves the board', async ($, on) => {
  const sim = engine($, on)
  await $.session.start(start)
  const rows = async (surface: RenderSurface) => {
    const pane = await mountPane($, surface)
    const chrome = await pane.find({ key: 'chrome' })
    await pane.unmount()
    return chrome?.children.length
  }

  const surfaces = ['terminal', 'desktop', 'mobile'] as const
  sim.openPane()
  for (const surface of surfaces) expect(await rows(surface)).toBe(2) // idle
  await $.turn.start({ text: 'go', turnId: 't1' })
  await sim.clock.advance(THRESHOLD_MS)
  for (const surface of surfaces) expect(await rows(surface)).toBe(2) // working
  await $.turn.complete(complete('t1'))
  expect(await bannerShown($)).toBe(true)
  for (const surface of surfaces) expect(await rows(surface)).toBe(2) // done
})

test('D3: the selected tab carries a mark on the terminal; other surfaces fill it natively', async ($, on) => {
  engine($, on)
  await $.session.start(start)
  const label = async (surface: RenderSurface) => {
    const pane = await mountPane($, surface)
    const tab = await pane.find({ key: 'tab:news' })
    await pane.unmount()
    return tab?.text
  }

  expect(await label('terminal')).toBe('› News')
  expect(await label('desktop')).toBe('News')
  const pane = await mountPane($)
  expect((await pane.find({ key: 'tab:games' }))?.text).toBe('  Games') // keeps the mark's room
  await pane.unmount()
})
