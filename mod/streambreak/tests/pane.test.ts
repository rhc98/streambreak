import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { expect, mock, test } from 'claude-code/testing'

const PANE = 'streambreak'
const SURFACES = ['terminal', 'desktop', 'mobile'] as const

const paneProps = {
  title: PANE,
  isFocused: false,
  bodyColumns: 60,
  placement: 'dock',
  scroll: { offset: 0, bodyRows: 20 },
  view: {},
} as const

const runCommand = ($: Engine) =>
  $.command.run({
    command: 'streambreak',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 160 },
  })

const quietEngine = (on: On) => {
  mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  on('http.fetch', () => {
    throw new Error('offline')
  })
  on('ui.log', () => ({ value: undefined }))
  on('ui.panes', () => ({ value: [] }))
  const toasts: string[] = []
  const closed: string[] = []
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.close', (_, e) => {
    closed.push(e.id)
    return { value: undefined }
  })

  return { toasts, closed }
}

for (const surface of SURFACES) {
  test(`V5 ${surface}: tabs switch and the close button closes the pane`, async ($, on) => {
    const sim = quietEngine(on)
    const pane = await $.ui.mount({
      plugin: 'streambreak',
      surface,
      component: 'Pane',
      requestId: PANE,
      props: paneProps,
    })

    expect(await pane.find({ key: 'tab:news' })).toMatchObject({ props: { variant: 'primary' } })
    await pane.press({ key: 'tab:games' })
    expect(await pane.find({ key: 'tab:games' })).toMatchObject({ props: { variant: 'primary' } })
    expect(await pane.find({ key: 'tab:news' })).toMatchObject({ props: { variant: 'secondary' } })

    await pane.press({ key: 'close' })
    expect(sim.closed).toEqual([PANE])
  })
}

test('F4: /streambreak opens the pane', async ($, on) => {
  const sim = quietEngine(on)
  const opened: string[] = []
  on('ui.open', (_, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })

  const result = await runCommand($)

  expect(opened).toEqual([PANE])
  expect(sim.toasts).toHaveLength(0)
  expect(result).toMatchObject({ text: expect.stringContaining('opened') })
})

test('S5: an unplaced pane is explained once, with no retry', async ($, on) => {
  const sim = quietEngine(on)
  let opens = 0
  on('ui.open', () => {
    opens += 1
    return { value: { isPlaced: false, reason: 'older desktop' } }
  })

  await runCommand($)

  expect(opens).toBe(1)
  expect(sim.toasts).toHaveLength(1)
  expect(sim.toasts[0]).toContain('older desktop')
})
