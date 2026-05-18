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
