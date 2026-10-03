import type { EngineInterface, Register, UiPane } from 'claude-code'
import { atom, read, update } from 'claude-code'

import type { Phase, Tab } from '../types'
import { strings } from './i18n'

// $.state refs must be declared in the file that reads or writes them (validate's scan rule),
// so every state access stays in this file; other modules hold pure logic and drawing.
const PANE = 'streambreak'
// Legacy app defaults (config.toml); userConfig takes over in F12.
const THRESHOLD_MS = 10_000
const FADE_OUT_MS = 3_000
const t = strings('en')

const phase = atom({ plugin: 'streambreak', key: 'phase' } as const, 'idle' as Phase)
const turnId = atom({ plugin: 'streambreak', key: 'turnId' } as const, null as string | null)
const turnStartedAt = atom(
  { plugin: 'streambreak', key: 'turnStartedAt' } as const,
  null as number | null,
)
const tab = atom({ plugin: 'streambreak', key: 'tab' } as const, 'news' as Tab)

// Timers die with the module on a reload; session.start re-arms them from $.state (S7).
type Timer = { cancel: () => void }
let suggestTimer: Timer | undefined
let fadeTimer: Timer | undefined

const ourPane = async ($: EngineInterface) => (await $.ui.panes()).find(pane => pane.id === PANE)
// The person can see it: placed (not waiting on width or an older desktop) and the front tab.
const isVisible = (pane: UiPane | undefined) => pane?.isShown === true && pane.isPlaced

// Moves phase only when it still stands at `from`, inside one versioned update, so a timer that
// woke up late never overwrites a transition another hook made meanwhile. True when it moved.
const transition = async ($: EngineInterface, from: Phase, to: Phase) => {
  let moved = false
  await update($, phase, current => {
    moved = current === from
    return moved ? to : current
  })

  return moved
}

const setIdle = async ($: EngineInterface) => {
  suggestTimer?.cancel()
  fadeTimer?.cancel()
  await update($, turnId, () => null)
  await update($, turnStartedAt, () => null)
  await update($, phase, () => 'idle' as Phase)
}

// F3: offer a break once per main turn when it outlasts the threshold.
const armSuggest = ($: EngineInterface, id: string, delayMs: number) => {
  suggestTimer?.cancel()
  suggestTimer = $.clock.after(Math.max(0, delayMs), () => {
    suggest($, id).catch(error => $.ui.log(`break offer failed: ${error}`))
  })
}

const suggest = async ($: EngineInterface, id: string) => {
  if ((await read($, turnId)) !== id || !(await transition($, 'working', 'suggested'))) return
  // A new turn may have started between the turnId read and the move: hand its phase back.
  if ((await read($, turnId)) !== id) {
    await transition($, 'suggested', 'working')
    return
  }
  const pane = await ourPane($)
  // S2: no toast over a visible pane; and none if the turn ended while we looked.
  if (isVisible(pane) || (await read($, phase)) !== 'suggested') return
  $.ui.toast(t.suggest)
}

// F7: after the banner shows, close the pane unless the person holds its keyboard (S1); then poll.
const armFade = ($: EngineInterface) => {
  fadeTimer?.cancel()
  fadeTimer = $.clock.after(FADE_OUT_MS, () => {
    fade($).catch(async error => {
      $.ui.log(`banner fade failed: ${error}`)
      await transition($, 'done', 'idle').catch(() => undefined)
    })
  })
}

const fade = async ($: EngineInterface) => {
  if ((await read($, phase)) !== 'done') return
  const pane = await ourPane($)
  if (isVisible(pane) && pane?.isFocused) return armFade($)
  // Moved to a background tab (or gone) meanwhile: drop the banner but never close it (S5).
  const isClosing = (await transition($, 'done', 'idle')) && isVisible(pane)
  if (isClosing) await $.ui.close({ id: PANE })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'streambreak', description: 'Open the streambreak pane' })

    // S7: a reload dropped the timers; re-arm from what $.state still holds.
    const current = await read($, phase)
    const id = await read($, turnId)
    const startedAt = await read($, turnStartedAt)
    if (current === 'working' && id !== null && startedAt !== null) {
      armSuggest($, id, THRESHOLD_MS - ((await $.clock.now()) - startedAt))
    }
    if (current === 'done') armFade($)

    return next(e)
  })

  // S10: /clear raises session.end alone (no new session.start); the game board survives.
  on('session.end', async ($, e, next) => {
    await setIdle($)

    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    fadeTimer?.cancel() // S2: a new turn takes the banner down
    suggestTimer?.cancel()
    // Claim the banner first, so a fade already in flight finds no 'done' and leaves the pane.
    await transition($, 'done', 'working')
    const now = await $.clock.now()
    // turnId first: a half-done write must never leave phase 'working' for a turn we don't track.
    await update($, turnId, () => e.turnId)
    await update($, turnStartedAt, () => now)
    await update($, phase, () => 'working' as Phase)
    armSuggest($, e.turnId, THRESHOLD_MS)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    // S3: subagent turns carry agentId; S4: a stale or unknown turn changes nothing.
    if (e.agentId !== undefined || e.turnId !== (await read($, turnId))) return next(e)

    suggestTimer?.cancel()
    // The banner says "finished", so only a real answer earns it, and only on a pane the person
    // sees; closing an unplaced or background pane would cancel what they asked for (S5).
    if (e.reason !== 'answer' || !isVisible(await ourPane($))) {
      await setIdle($)
    } else {
      await update($, turnId, () => null)
      await update($, turnStartedAt, () => null)
      await update($, phase, () => 'done' as Phase)
      armFade($)
    }

    return next(e)
  })

  on('ui.close', { id: PANE }, async ($, e, next) => {
    if (await transition($, 'done', 'idle')) fadeTimer?.cancel()

    return next(e)
  })

  // F4 / S5: the pane opens only on the person's action; a pane left unplaced is explained once.
  on('command.run', { command: 'streambreak' }, async $ => {
    const opened = await $.ui.open({ id: PANE, title: 'streambreak' })
    if (opened.isPlaced) return { text: t.opened }

    $.ui.toast(t.notPlaced(opened.reason))

    return { text: t.notPlaced(opened.reason) }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const [currentPhase, currentTab] = await Promise.all([read($, phase), read($, tab)])
    const select = (next: Tab) => () => void update($, tab, () => next)

    return (
      <Box flexDirection="column" gap={1}>
        {currentPhase === 'done' && (
          <Box key="banner">
            <Text bold color="green">
              {t.done}
            </Text>
          </Box>
        )}
        <Box flexDirection="row" gap={1}>
          <Button
            key="tab:news"
            variant={currentTab === 'news' ? 'primary' : 'secondary'}
            onPress={select('news')}
          >
            {t.news}
          </Button>
          <Button
            key="tab:games"
            variant={currentTab === 'games' ? 'primary' : 'secondary'}
            onPress={select('games')}
          >
            {t.games}
          </Button>
          <Button key="close" role="dismiss" onPress={() => void $.ui.close({ id: PANE })}>
            {t.close}
          </Button>
        </Box>
        {currentTab === 'news' ? (
          <Text dimColor>{t.newsEmpty}</Text>
        ) : (
          <Text dimColor>{t.gamesEmpty}</Text>
        )}
      </Box>
    )
  })
}
