/**
 * Resolves a safe in-app return path from router location state.
 *
 * Accepts only same-origin absolute paths ("/...") and rejects protocol-relative
 * forms ("//...") so an attacker cannot smuggle an external redirect via state.
 */
export function resolveScorecardBackPath(state: unknown): string {
  if (!state || typeof state !== 'object') return '/'
  if (!('backTo' in state)) return '/'
  const value = (state as { backTo: unknown }).backTo
  if (typeof value !== 'string') return '/'
  if (!value.startsWith('/')) return '/'
  if (value.startsWith('//')) return '/'
  return value
}

export function resolveScorecardBackPlayerName(state: unknown): string | null {
  if (!state || typeof state !== 'object') return null
  if (!('backToPlayerName' in state)) return null
  const value = (state as { backToPlayerName: unknown }).backToPlayerName
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}
