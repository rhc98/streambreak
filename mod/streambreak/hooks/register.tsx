// F1 spike: records what the engine actually does (pane placement, classic.Notification,
// turn events, reloads) into a pane so the plan's unverified assumptions can be checked.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { SpikeLog } from '../types'

const PANE = 'streambreak'
const spikeLog = atom({ plugin: 'streambreak', key: 'spikeLog' } as const, [] as SpikeLog)

const note = ($: EngineInterface, text: string) =>
  update($, spikeLog, list => [...list, `${new Date().toISOString().slice(11, 19)} ${text}`].slice(-60))

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'streambreak', description: 'Open the streambreak pane' })
    await note($, `session.start surface=${e.surface} interactive=${e.isInteractive}`)

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    await note($, `session.end reason=${e.reason}`)

    return next(e)
  })

  on('command.run', { command: 'streambreak' }, async $ => {
    const opened = await $.ui.open({ id: PANE, title: 'streambreak' })
    const text = opened.isPlaced ? 'isPlaced=true' : `isPlaced=false reason=${opened.reason}`
    await note($, `/streambreak → ${text}`)
    $.ui.toast(`streambreak: ${text}`)

    return { text: `streambreak pane: ${text}` }
  })

  on('turn.start', async ($, e, next) => {
    await note($, `turn.start ${e.turnId}`)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    await note(
      $,
      `turn.complete ${e.turnId} reason=${e.reason} aborted=${e.isAborted} agent=${e.agentId ?? '-'}`,
    )

    return next(e)
  })

  on('classic.Notification', async ($, e, next) => {
    await note($, `classic.Notification ${JSON.stringify(e).slice(0, 160)}`)
    $.ui.toast('streambreak: classic.Notification fired')

    return next(e)
  })

  on('tool.check', async ($, e, next) => {
    const verdict = await next(e)
    if (verdict.decision !== 'allow') await note($, `tool.check ${e.tool} → ${verdict.decision}`)

    return verdict
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const list = await read($, spikeLog)
    const room = Math.max(1, (e.viewport?.rows ?? 24) - 6)

    return (
      <Box flexDirection="column">
        <Text bold>
          streambreak spike v3 ·surface={e.surface} placement={e.props.placement} viewport=
          {e.viewport ? `${e.viewport.columns}x${e.viewport.rows}` : '-'}
        </Text>
        {list.slice(-room).map(line => (
          <Text dimColor>{line}</Text>
        ))}
        <Button onPress={async () => update($, spikeLog, () => [])}>Clear log</Button>
      </Box>
    )
  })
}
