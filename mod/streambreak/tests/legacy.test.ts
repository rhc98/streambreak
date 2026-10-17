import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { hasLegacyHooks } from '../hooks/legacy'

// What src-tauri/src/cli/init.rs writes, field for field.
const LEGACY = {
  hooks: {
    PreToolUse: [
      { matcher: '', hooks: [{ type: 'command', command: 'streambreak timer start', timeout: 3 }] },
    ],
    Notification: [
      {
        matcher: 'idle_prompt|permission_prompt',
        hooks: [{ type: 'command', command: 'streambreak show --reason=idle', timeout: 3 }],
      },
    ],
    Stop: [
      {
        matcher: '',
        hooks: [{ type: 'command', command: 'streambreak hide --reason=complete', timeout: 3 }],
      },
    ],
  },
}
const withCommand = (command: string) => ({
  hooks: { Stop: [{ hooks: [{ type: 'command', command }] }] },
})

test('F15: the hooks `streambreak init` writes are found', () => {
  expect(hasLegacyHooks(LEGACY)).toBe(true)
})

test('F15: absolute and quoted paths to the CLI are found too', () => {
  expect(hasLegacyHooks(withCommand('/opt/homebrew/bin/streambreak hide --reason=complete'))).toBe(
    true,
  )
  expect(
    hasLegacyHooks(withCommand('"/Applications/streambreak.app/Contents/MacOS/streambreak" show')),
  ).toBe(true)
})

test('F15: other hooks, look-alikes, the word elsewhere and disabled hooks are not', () => {
  expect(hasLegacyHooks(withCommand('echo done'))).toBe(false)
  expect(hasLegacyHooks(withCommand('mystreambreak show'))).toBe(false)
  expect(hasLegacyHooks(withCommand('streambreak show-foo'))).toBe(false)
  expect(hasLegacyHooks({ hooks: {}, env: { NOTE: 'streambreak show' } })).toBe(false)
  expect(hasLegacyHooks({ ...LEGACY, disableAllHooks: true })).toBe(false)
  expect(hasLegacyHooks({})).toBe(false)
  expect(hasLegacyHooks(undefined)).toBe(false)
})

const engine = (on: On, userSettings: Readonly<Record<string, unknown>>) => {
  mock.clock(on)
  mock.store(on)
  const toasts: { text: string; timeoutMs?: number }[] = []
  on('settings.read', (_, e) => ({ value: e?.source === 'user' ? userSettings : {} }))
  on('ui.toast', (_, e) => {
    toasts.push({ text: e.text, timeoutMs: e.timeoutMs })
    return { value: undefined }
  })
  on('ui.log', () => ({ value: undefined }))
  on('ui.panes', () => ({ value: [] }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  return { toasts }
}

const start = { cwd: '/repo', surface: 'desktop', isInteractive: false } as const

test('F15: a session with the legacy hooks gets one long warning, not one per reload', async ($, on) => {
  const sim = engine(on, LEGACY)
  await $.session.start(start)
  await $.session.start(start) // a reload

  expect(sim.toasts).toHaveLength(1)
  expect(sim.toasts[0]?.text).toContain('settings.json')
  expect(sim.toasts[0]?.timeoutMs).toBe(12_000)
})

test('F15: settings with other hooks, or none, give no warning', async ($, on) => {
  const sim = engine(on, withCommand('echo done'))
  await $.session.start(start)

  expect(sim.toasts).toHaveLength(0)
})

test('F15: the warning follows the language', { options: { language: 'ko' } }, async ($, on) => {
  const sim = engine(on, LEGACY)
  await $.session.start(start)

  expect(sim.toasts[0]?.text).toContain('예전 앱 훅')
})
