/**
 * Formats a player's to-par delta as a compact badge for the scorecard overview.
 *
 * - `''` when no holes have been scored yet (delta is not meaningful).
 * - `'E'` when even.
 * - `'+N'` / `'-N'` otherwise.
 */
export function formatToParBadge(totalDelta: number, scoredHoles: number): string {
  if (scoredHoles <= 0) return ''
  if (totalDelta === 0) return 'E'
  if (totalDelta > 0) return `+${totalDelta}`
  return `${totalDelta}`
}
