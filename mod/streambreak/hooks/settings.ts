// F12: the manifest's userConfig (the legacy config.toml values) as the timings the hooks use.
// Pure: register(on, options) passes the engine's options; a change in the config menu reloads
// the module with new ones.
import type { PluginOptions } from 'claude-code'

import type { Language } from './i18n'

export type Settings = {
  thresholdMs: number
  rotationMs: number
  fadeOutMs: number
  language: Language
}

export const DEFAULT_SETTINGS: Settings = {
  thresholdMs: 10_000,
  rotationMs: 15_000,
  fadeOutMs: 3_000,
  language: 'en',
}

const numberOr = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback

export const isLanguage = (value: unknown): value is Language => value === 'en' || value === 'ko'

/** Reads the options, clamping each to a range the UI survives (a 0 s rotation would spin). */
export const settingsFrom = (options: PluginOptions | undefined): Settings => ({
  thresholdMs:
    numberOr(options?.threshold_seconds, DEFAULT_SETTINGS.thresholdMs / 1000, 1, 3_600) * 1000,
  rotationMs:
    numberOr(options?.rotation_seconds, DEFAULT_SETTINGS.rotationMs / 1000, 5, 3_600) * 1000,
  fadeOutMs: numberOr(options?.fade_out_delay_ms, DEFAULT_SETTINGS.fadeOutMs, 0, 60_000),
  language: isLanguage(options?.language) ? options.language : DEFAULT_SETTINGS.language,
})

/**
 * S6: which language wins and what to keep. The pane toggle's override beats the setting, but a
 * setting changed in the config menu since we last saw it clears the override.
 */
export const resolveLanguage = (
  configured: Language,
  lastConfigured: unknown,
  override: unknown,
): { language: Language; isOverrideCleared: boolean } => {
  const isConfigChanged = isLanguage(lastConfigured) && lastConfigured !== configured
  if (isConfigChanged || !isLanguage(override)) {
    return { language: configured, isOverrideCleared: isConfigChanged && isLanguage(override) }
  }
  return { language: override, isOverrideCleared: false }
}
