import type { Register } from 'claude-code'
import { atom, read } from 'claude-code'

import type { GameKind, Phase, Tab } from '../types'

// $.state refs must be declared in the file that reads or writes them (validate's scan rule),
// so every state access stays in this file; other modules hold pure logic and drawing.
const PANE = 'streambreak'

const phase = atom({ plugin: 'streambreak', key: 'phase' } as const, 'idle' as Phase)
const turnId = atom({ plugin: 'streambreak', key: 'turnId' } as const, null as string | null)
const tab = atom({ plugin: 'streambreak', key: 'tab' } as const, 'news' as Tab)
const newsIndex = atom({ plugin: 'streambreak', key: 'newsIndex' } as const, 0)
const game = atom({ plugin: 'streambreak', key: 'game' } as const, null as GameKind | null)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'streambreak', description: 'Open the streambreak pane' })

    return next(e)
  })

  on('command.run', { command: 'streambreak' }, async $ => {
    await $.ui.open({ id: PANE, title: 'streambreak' })

    return { text: 'streambreak pane opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const [currentPhase, currentTab, index, currentGame, turn] = await Promise.all([
      read($, phase),
      read($, tab),
      read($, newsIndex),
      read($, game),
      read($, turnId),
    ])

    return (
      <Box flexDirection="column">
        <Text dimColor>
          streambreak · phase={currentPhase} tab={currentTab} news={index} game=
          {currentGame ?? '-'} turn={turn ?? '-'}
        </Text>
      </Box>
    )
  })
}
