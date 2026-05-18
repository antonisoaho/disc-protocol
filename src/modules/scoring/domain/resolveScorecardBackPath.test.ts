import { describe, expect, it } from 'vitest'

import { resolveScorecardBackPath } from '@modules/scoring/domain/resolveScorecardBackPath'

describe('resolveScorecardBackPath', () => {
  it('returns "/" when state is undefined', () => {
    expect(resolveScorecardBackPath(undefined)).toBe('/')
  })

  it('returns "/" when state is null', () => {
    expect(resolveScorecardBackPath(null)).toBe('/')
  })

  it('returns "/" when state has no backTo', () => {
    expect(resolveScorecardBackPath({ other: '/foo' })).toBe('/')
  })

  it('returns "/" when backTo is not a string', () => {
    expect(resolveScorecardBackPath({ backTo: 42 })).toBe('/')
  })

  it('returns "/" when backTo does not start with "/"', () => {
    expect(resolveScorecardBackPath({ backTo: 'https://evil.example.com' })).toBe('/')
  })

  it('returns "/" when backTo is a protocol-relative URL', () => {
    expect(resolveScorecardBackPath({ backTo: '//evil.example.com/x' })).toBe('/')
  })

  it('returns the backTo path when it is a valid app-internal path', () => {
    expect(resolveScorecardBackPath({ backTo: '/players/abc123' })).toBe('/players/abc123')
  })

  it('returns "/" for empty string', () => {
    expect(resolveScorecardBackPath({ backTo: '' })).toBe('/')
  })
})
