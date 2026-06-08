import type { RoundScoringMode } from '@core/domain/round'
import type { RoundTeam } from '@core/domain/roundTeams'
import { normalizeRoundTeams } from '@core/domain/roundTeams'

export type ScrambleRoundLike = {
  scoringMode?: RoundScoringMode
  teams?: RoundTeam[] | null | undefined
}

export type ScrambleScoringUnit =
  | { kind: 'team'; teamId: string; name: string; participantIds: string[] }
  | { kind: 'solo'; participantId: string; name: string }

export type ScrambleGridRow = {
  rowId: string
  displayName: string
  scoreParticipantId: string
}

export function isScrambleRound(participantIds: string[], round: ScrambleRoundLike): boolean {
  if (round.scoringMode === 'scramble') {
    return true
  }
  if (round.scoringMode === 'individual') {
    return false
  }
  return normalizeRoundTeams(participantIds, round.teams).length > 0
}

export function resolveScrambleScoringUnits(params: {
  participantIds: string[]
  teams: RoundTeam[] | null | undefined
  participantNames: Record<string, string>
}): ScrambleScoringUnit[] {
  const teams = normalizeRoundTeams(params.participantIds, params.teams)
  if (teams.length === 0) {
    return []
  }

  const claimed = new Set(teams.flatMap((team) => team.participantIds))
  const units: ScrambleScoringUnit[] = teams.map((team) => ({
    kind: 'team',
    teamId: team.id,
    name: team.name,
    participantIds: team.participantIds,
  }))

  for (const participantId of params.participantIds) {
    if (!claimed.has(participantId)) {
      units.push({
        kind: 'solo',
        participantId,
        name: params.participantNames[participantId] ?? participantId,
      })
    }
  }

  return units
}

export function readTeamScoreInput(team: RoundTeam, scoreInputs: Record<string, string>): string {
  for (const participantId of team.participantIds) {
    const value = scoreInputs[participantId]?.trim()
    if (value) {
      return scoreInputs[participantId] ?? ''
    }
  }
  return scoreInputs[team.participantIds[0]] ?? ''
}

export function applyTeamScoreInput(
  team: RoundTeam,
  value: string,
  scoreInputs: Record<string, string>,
): Record<string, string> {
  const next = { ...scoreInputs }
  for (const participantId of team.participantIds) {
    next[participantId] = value
  }
  return next
}

export function resolveScrambleGridRows(params: {
  participantIds: string[]
  teams: RoundTeam[] | null | undefined
  participantNames: Record<string, string>
}): ScrambleGridRow[] | null {
  const units = resolveScrambleScoringUnits(params)
  if (units.length === 0) {
    return null
  }

  return units.map((unit) => {
    if (unit.kind === 'team') {
      return {
        rowId: unit.teamId,
        displayName: unit.name,
        scoreParticipantId: unit.participantIds[0],
      }
    }
    return {
      rowId: unit.participantId,
      displayName: unit.name,
      scoreParticipantId: unit.participantId,
    }
  })
}
