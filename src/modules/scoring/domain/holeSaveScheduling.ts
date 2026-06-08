export type HoleSaveScheduler = {
  run: (holeNumber: number, task: () => Promise<boolean>) => Promise<boolean>
}

export function createHoleSaveScheduler(): HoleSaveScheduler {
  const inFlight = new Map<number, Promise<boolean>>()
  const reschedule = new Set<number>()

  return {
    async run(holeNumber, task) {
      const existing = inFlight.get(holeNumber)
      if (existing) {
        reschedule.add(holeNumber)
        return existing
      }

      const promise = (async () => {
        let lastResult = await task()
        while (reschedule.has(holeNumber)) {
          reschedule.delete(holeNumber)
          lastResult = await task()
        }
        return lastResult
      })()

      inFlight.set(holeNumber, promise)
      try {
        return await promise
      } finally {
        inFlight.delete(holeNumber)
      }
    },
  }
}
