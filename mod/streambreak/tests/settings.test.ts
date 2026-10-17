import { expect, test } from 'claude-code/testing'

import { DEFAULT_SETTINGS, resolveLanguage, settingsFrom } from '../hooks/settings'

test('F12: missing options fall back to the legacy config.toml defaults', () => {
  expect(settingsFrom(undefined)).toEqual(DEFAULT_SETTINGS)
  expect(settingsFrom({})).toEqual({
    thresholdMs: 10_000,
    rotationMs: 15_000,
    fadeOutMs: 3_000,
    language: 'en',
  })
})

test('F12: options are read and clamped to ranges the UI survives', () => {
  expect(
    settingsFrom({
      threshold_seconds: 30,
      rotation_seconds: 20,
      fade_out_delay_ms: 500,
      language: 'ko',
    }),
  ).toEqual({ thresholdMs: 30_000, rotationMs: 20_000, fadeOutMs: 500, language: 'ko' })
  expect(
    settingsFrom({ threshold_seconds: 0, rotation_seconds: 1, fade_out_delay_ms: -5 }),
  ).toMatchObject({
    thresholdMs: 1_000,
    rotationMs: 5_000,
    fadeOutMs: 0,
  })
  expect(settingsFrom({ threshold_seconds: 'soon', language: 'fr' })).toMatchObject({
    thresholdMs: 10_000,
    language: 'en',
  })
})

test('S6: the pane override beats the setting until the setting changes in the menu', () => {
  // No override yet: the setting.
  expect(resolveLanguage('en', undefined, undefined)).toEqual({
    language: 'en',
    isOverrideCleared: false,
  })
  // An override made against the same setting: the override.
  expect(resolveLanguage('en', 'en', 'ko')).toEqual({ language: 'ko', isOverrideCleared: false })
  // The setting changed since: the setting, and the override goes.
  expect(resolveLanguage('ko', 'en', 'en')).toEqual({ language: 'ko', isOverrideCleared: true })
  // A junk override is ignored.
  expect(resolveLanguage('ko', 'ko', 'fr')).toEqual({ language: 'ko', isOverrideCleared: false })
})
