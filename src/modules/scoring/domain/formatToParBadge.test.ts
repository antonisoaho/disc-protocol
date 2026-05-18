import { describe, expect, it } from 'vitest'

import { formatToParBadge } from '@modules/scoring/domain/formatToParBadge'

describe('formatToParBadge', () => {
  it('returns empty string when no holes are scored', () => {
    expect(formatToParBadge(0, 0)).toBe('')
    expect(formatToParBadge(5, 0)).toBe('')
  })

  it('returns "E" when delta is zero and at least one hole scored', () => {
    expect(formatToParBadge(0, 1)).toBe('E')
    expect(formatToParBadge(0, 18)).toBe('E')
  })

  it('returns "+N" for positive deltas', () => {
    expect(formatToParBadge(1, 3)).toBe('+1')
    expect(formatToParBadge(7, 18)).toBe('+7')
  })

  it('returns "-N" for negative deltas (single minus, no double sign)', () => {
    expect(formatToParBadge(-1, 3)).toBe('-1')
    expect(formatToParBadge(-5, 18)).toBe('-5')
  })
})
