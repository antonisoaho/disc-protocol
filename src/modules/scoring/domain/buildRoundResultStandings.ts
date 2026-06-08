import type { ParticipantTotals } from '@core/domain/scorecardTable'
import { resolveScrambleGridRows } from '@core/domain/scrambleScoring'
import type { RoundTeam } from '@core/domain/roundTeams'
import { formatToParBadge } from '@modules/scoring/domain/formatToParBadge'

export type RoundResultUnit = {
  id: string
  displayName: string
  scoreParticipantId: string
}

export type RoundResultStanding = {
  id: string
  displayName: string
  place: number
  totalStrokes: number
  toParLabel: string
}

export function buildRoundResultUnits(params: {
  participantIds: string[]
  participantNames: Record<string, string>
  teams?: RoundTeam[]
}): RoundResultUnit[] {
  const gridRows = resolveScrambleGridRows({
    participantIds: params.participantIds,
    teams: params.teams,
    participantNames: params.participantNames,
  })
  if (gridRows) {
    return gridRows.map((row) => ({
      id: row.rowId,
      displayName: row.displayName,
      scoreParticipantId: row.scoreParticipantId,
    }))
  }
  return params.participantIds.map((participantId) => ({
    id: participantId,
    displayName: params.participantNames[participantId] ?? participantId,
    scoreParticipantId: participantId,
  }))
}

export function buildRoundResultStandings(
  units: RoundResultUnit[],
  totalsByParticipant: Record<string, ParticipantTotals>,
): RoundResultStanding[] {
  const scored = units
    .map((unit) => ({
      unit,
      totals: totalsByParticipant[unit.scoreParticipantId],
    }))
    .filter((row) => (row.totals?.scoredHoles ?? 0) > 0)
    .sort((left, right) => (left.totals?.totalStrokes ?? 0) - (right.totals?.totalStrokes ?? 0))

  const standings: RoundResultStanding[] = []
  let index = 0
  let nextPlace = 1

  while (index < scored.length) {
    const leaderStrokes = scored[index]?.totals?.totalStrokes ?? 0
    let end = index
    while (end < scored.length && (scored[end]?.totals?.totalStrokes ?? 0) === leaderStrokes) {
      end += 1
    }

    for (let rowIndex = index; rowIndex < end; rowIndex += 1) {
      const row = scored[rowIndex]
      if (!row?.totals) {
        continue
      }
      standings.push({
        id: row.unit.id,
        displayName: row.unit.displayName,
        place: nextPlace,
        totalStrokes: row.totals.totalStrokes,
        toParLabel: formatToParBadge(row.totals.totalDelta, row.totals.scoredHoles),
      })
    }

    nextPlace += end - index
    index = end
  }

  return standings
}

export function pickWinnerNames(standings: RoundResultStanding[]): string[] {
  return standings.filter((row) => row.place === 1).map((row) => row.displayName)
}
