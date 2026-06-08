import { describe, expect, it, vi } from 'vitest'
import { createHoleSaveScheduler } from '@modules/scoring/domain/holeSaveScheduling'

describe('createHoleSaveScheduler', () => {
  it('reruns save when another flush is requested while one is in flight', async () => {
    const scheduler = createHoleSaveScheduler()
    let draft = 'team-1'
    const run = vi.fn(async () => {
      await Promise.resolve()
      return draft
    })

    const first = scheduler.run(1, async () => {
      await run()
      return true
    })
    draft = 'team-1-and-2'
    const second = scheduler.run(1, async () => {
      await run()
      return true
    })

    await Promise.all([first, second])
    expect(run).toHaveBeenCalledTimes(2)
  })
})
