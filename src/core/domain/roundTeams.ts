export const ROUND_TEAM_ID_PREFIX = 'team:'

export type RoundTeam = {
  id: string
  name: string
  participantIds: string[]
}

export function isRoundTeamId(value: string): boolean {
  return value.trim().startsWith(ROUND_TEAM_ID_PREFIX)
}

export function createRoundTeamId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${ROUND_TEAM_ID_PREFIX}${globalThis.crypto.randomUUID()}`
  }
  const randomSuffix = Math.random().toString(36).slice(2, 10)
  return `${ROUND_TEAM_ID_PREFIX}${randomSuffix}`
}

export function normalizeRoundTeams(
  participantIds: string[],
  teams: RoundTeam[] | null | undefined,
): RoundTeam[] {
  const allowed = new Set(
    participantIds.map((participantId) => participantId.trim()).filter((participantId) => participantId.length > 0),
  )
  const claimed = new Set<string>()
  const normalized: RoundTeam[] = []

  for (const team of teams ?? []) {
    const id = team.id?.trim() ?? ''
    const name = team.name?.trim() ?? ''
    if (!isRoundTeamId(id) || name.length === 0) {
      continue
    }

    const members: string[] = []
    for (const participantId of team.participantIds ?? []) {
      const normalizedParticipantId = participantId.trim()
      if (!allowed.has(normalizedParticipantId) || claimed.has(normalizedParticipantId)) {
        continue
      }
      claimed.add(normalizedParticipantId)
      members.push(normalizedParticipantId)
    }

    if (members.length === 0) {
      continue
    }
    normalized.push({ id, name, participantIds: members })
  }

  return normalized
}

export function toggleTeamMember(teams: RoundTeam[], teamId: string, participantId: string): RoundTeam[] {
  const targetTeam = teams.find((team) => team.id === teamId)
  const isMember = targetTeam?.participantIds.includes(participantId) ?? false

  if (isMember) {
    return teams.map((team) =>
      team.id === teamId
        ? { ...team, participantIds: team.participantIds.filter((memberId) => memberId !== participantId) }
        : team,
    )
  }

  return teams.map((team) => {
    const withoutParticipant = team.participantIds.filter((memberId) => memberId !== participantId)
    if (team.id === teamId) {
      return { ...team, participantIds: [...withoutParticipant, participantId] }
    }
    return { ...team, participantIds: withoutParticipant }
  })
}

export function removeParticipantFromTeams(teams: RoundTeam[], participantId: string): RoundTeam[] {
  return teams.map((team) => ({
    ...team,
    participantIds: team.participantIds.filter((memberId) => memberId !== participantId),
  }))
}

export function removeTeam(teams: RoundTeam[], teamId: string): RoundTeam[] {
  return teams.filter((team) => team.id !== teamId)
}

export function participantTeamId(teams: RoundTeam[], participantId: string): string | null {
  for (const team of teams) {
    if (team.participantIds.includes(participantId)) {
      return team.id
    }
  }
  return null
}
