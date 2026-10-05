import { expect, test } from 'claude-code/testing'

import { clip, columnsOf } from '../hooks/views'

test('F17: Hangul, CJK and emoji count two columns', () => {
  expect(columnsOf('abc')).toBe(3)
  expect(columnsOf('한글')).toBe(4)
  expect(columnsOf('🔥 hi')).toBe(5)
})

test('F17: clip cuts to the column budget with an ellipsis, never splitting a wide glyph', () => {
  expect(clip('short', 10)).toBe('short')
  expect(clip('a long english title', 10)).toBe('a long en…')
  expect(columnsOf(clip('한국어 제목이 아주 깁니다', 10))).toBeLessThanOrEqual(10)
  expect(clip('한국어 제목이 아주 깁니다', 10).endsWith('…')).toBe(true)
})
