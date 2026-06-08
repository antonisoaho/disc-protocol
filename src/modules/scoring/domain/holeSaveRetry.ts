export const HOLE_SAVE_MAX_RETRIES = 3

export function holeSaveRetryDelayMs(attempt: number): number {
  if (attempt <= 0) {
    return 0
  }
  return 400 * 2 ** (attempt - 1)
}

export function shouldRetryHoleSave(attempt: number): boolean {
  return attempt < HOLE_SAVE_MAX_RETRIES
}

export function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}
