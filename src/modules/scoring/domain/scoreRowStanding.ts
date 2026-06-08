import type { ParticipantTotals } from '@core/domain/scorecardTable'

export type StandingEntry = {
  id: string
  totals?: ParticipantTotals
}

/**
 * Leaderboard label for a score input row relative to other rows in the same list.
 * Sole leader shows `L`; tied leaders show `E`; others show `+N` strokes behind.
 */
export function formatRelativeStandingLabel(params: {
  totalStrokes: number
  scoredHoles: number
  leaderStrokes: number | null
  tiedLeaderCount: number
}): string {
  if (params.scoredHoles <= 0 || params.leaderStrokes === null) {
    return ''
  }
  const behind = params.totalStrokes - params.leaderStrokes
  if (behind <= 0) {
    return params.tiedLeaderCount >= 2 ? 'E' : 'L'
  }
  return `+${behind}`
}

export function countTiedLeaders(
  entries: Array<{ totalStrokes: number; scoredHoles: number }>,
  leaderStrokes: number,
): number {
  return entries.filter((entry) => entry.scoredHoles > 0 && entry.totalStrokes === leaderStrokes).length
}

export function resolveLeaderStrokes(entries: Array<{ totalStrokes: number; scoredHoles: number }>): number | null {
  const scored = entries.filter((entry) => entry.scoredHoles > 0)
  if (scored.length === 0) {
    return null
  }
  return Math.min(...scored.map((entry) => entry.totalStrokes))
}

export function computeRelativeStandingById(entries: StandingEntry[]): Record<string, string> {
  const scoredEntries = entries.map((entry) => ({
    totalStrokes: entry.totals?.totalStrokes ?? 0,
    scoredHoles: entry.totals?.scoredHoles ?? 0,
  }))
  const leaderStrokes = resolveLeaderStrokes(scoredEntries)
  const tiedLeaderCount =
    leaderStrokes === null ? 0 : countTiedLeaders(scoredEntries, leaderStrokes)

  const out: Record<string, string> = {}
  for (const entry of entries) {
    out[entry.id] = formatRelativeStandingLabel({
      totalStrokes: entry.totals?.totalStrokes ?? 0,
      scoredHoles: entry.totals?.scoredHoles ?? 0,
      leaderStrokes,
      tiedLeaderCount,
    })
  }
  return out
}
