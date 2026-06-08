import { describe, expect, it } from 'vitest'
import { holeSaveRetryDelayMs, shouldRetryHoleSave } from '@modules/scoring/domain/holeSaveRetry'

describe('holeSaveRetry', () => {
  it('backs off between save retries', () => {
    expect(holeSaveRetryDelayMs(1)).toBe(400)
    expect(holeSaveRetryDelayMs(2)).toBe(800)
    expect(holeSaveRetryDelayMs(3)).toBe(1600)
  })

  it('allows up to three attempts', () => {
    expect(shouldRetryHoleSave(0)).toBe(true)
    expect(shouldRetryHoleSave(2)).toBe(true)
    expect(shouldRetryHoleSave(3)).toBe(false)
  })
})
