// F15: the Tauri app's `streambreak init` writes command hooks into Claude Code's user settings
// (`streambreak show --reason=idle`, `streambreak timer start`, `streambreak hide --reason=complete`).
// Left in place next to this mod, they pop the app's window too. Pure: the settings object the
// engine loaded (`$.settings.read({ source: 'user' })`) in, the answer out.

// The CLI name, bare or as a path, optionally quoted, then one of its three hook subcommands.
const LEGACY_COMMAND = /(^|[\s/"'])streambreak["']?\s+(show|hide|timer)(?=\s|$)/

const commandsIn = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap(commandsIn)
  if (typeof value !== 'object' || value === null) return []
  const entry = value as Record<string, unknown>
  const own = typeof entry.command === 'string' ? [entry.command] : []

  return [...own, ...Object.values(entry).flatMap(commandsIn)]
}

/** True when the settings still run the legacy streambreak CLI from a live hook. */
export const hasLegacyHooks = (settings: unknown) => {
  if (typeof settings !== 'object' || settings === null) return false
  const { hooks, disableAllHooks } = settings as { hooks?: unknown; disableAllHooks?: unknown }
  if (disableAllHooks === true) return false

  return commandsIn(hooks).some(command => LEGACY_COMMAND.test(command))
}
