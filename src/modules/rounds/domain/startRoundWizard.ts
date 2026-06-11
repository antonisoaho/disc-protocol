import {
  normalizeWizardTeams,
  presetsToWizardTeams,
  type ProfileScrambleTeamPreset,
} from '@core/domain/profileScrambleTeams'
import {
  createRoundTeamId,
  removeParticipantFromTeams,
  removeTeam,
  toggleTeamMember,
  type RoundTeam,
} from '@core/domain/roundTeams'

export type WizardStep = 'course' | 'players' | 'review'

export type CourseMode = 'saved' | 'quick'

export type SavedTeamPresetSummary = {
  presetId: string
  teamName: string
  memberNames: string
  hasRosterMembers: boolean
}

export type ReviewTeamSummary = {
  name: string
  memberNames: string
}

export function validateCourseStep(params: {
  courseMode: CourseMode
  selectedSavedCourseId: string | null
  freshCourseName: string
}): boolean {
  if (params.courseMode === 'saved') {
    return params.selectedSavedCourseId !== null && params.selectedSavedCourseId.trim().length > 0
  }
  return params.freshCourseName.trim().length > 0
}

export function resolveInitialCourseMode(params: {
  availableCourseIds: string[]
  favoriteCourseIds: string[]
}): CourseMode {
  if (params.availableCourseIds.length === 0) {
    return 'quick'
  }
  const favoriteMatch = params.favoriteCourseIds.find((id) => params.availableCourseIds.includes(id))
  if (favoriteMatch) {
    return 'saved'
  }
  return 'saved'
}

export function resolveInitialSavedCourseId(params: {
  sortedCourseIds: string[]
  favoriteCourseIds: string[]
}): string | null {
  if (params.sortedCourseIds.length === 0) {
    return null
  }
  const favoriteMatch = params.favoriteCourseIds.find((id) => params.sortedCourseIds.includes(id))
  return favoriteMatch ?? params.sortedCourseIds[0] ?? null
}

export function syncWizardTeamsWithRoster(participantIds: string[], teams: RoundTeam[]): RoundTeam[] {
  return normalizeWizardTeams(participantIds, teams)
}

export function applyAllSavedTeamsToWizard(
  participantIds: string[],
  presets: ProfileScrambleTeamPreset[],
): RoundTeam[] {
  return presetsToWizardTeams(participantIds, presets)
}

export function applyOneSavedTeamToWizard(
  participantIds: string[],
  teams: RoundTeam[],
  preset: ProfileScrambleTeamPreset,
): RoundTeam[] {
  const applied = presetsToWizardTeams(participantIds, [preset])
  if (applied.length === 0) {
    return normalizeWizardTeams(participantIds, teams)
  }
  const nextTeam = applied[0]!
  const withoutPreset = teams.filter((team) => team.id !== preset.id)
  return normalizeWizardTeams(participantIds, [...withoutPreset, nextTeam])
}

export function addWizardTeam(teams: RoundTeam[], defaultName: string): RoundTeam[] {
  return [...teams, { id: createRoundTeamId(), name: defaultName, participantIds: [] }]
}

export function updateWizardTeamName(teams: RoundTeam[], teamId: string, name: string): RoundTeam[] {
  return teams.map((team) => (team.id === teamId ? { ...team, name } : team))
}

export function removeWizardTeam(teams: RoundTeam[], teamId: string): RoundTeam[] {
  return removeTeam(teams, teamId)
}

export function toggleWizardTeamMember(
  teams: RoundTeam[],
  teamId: string,
  participantId: string,
): RoundTeam[] {
  return toggleTeamMember(teams, teamId, participantId)
}

export function removeWizardParticipantFromTeams(teams: RoundTeam[], participantId: string): RoundTeam[] {
  return removeParticipantFromTeams(teams, participantId)
}

export function buildSavedTeamPresetSummaries(
  presets: ProfileScrambleTeamPreset[],
  participantIds: string[],
  nameById: ReadonlyMap<string, string>,
): SavedTeamPresetSummary[] {
  const roster = new Set(participantIds)
  return presets.map((preset) => {
    const rosterMemberIds = preset.memberUids.filter((memberUid) => roster.has(memberUid))
    const memberNames =
      rosterMemberIds.length > 0
        ? rosterMemberIds.map((memberUid) => nameById.get(memberUid) ?? memberUid).join(', ')
        : preset.memberUids.map((memberUid) => nameById.get(memberUid) ?? memberUid).join(', ')
    return {
      presetId: preset.id,
      teamName: preset.name,
      memberNames,
      hasRosterMembers: rosterMemberIds.length > 0,
    }
  })
}

export function buildReviewTeamSummaries(
  teams: RoundTeam[],
  nameById: ReadonlyMap<string, string>,
): ReviewTeamSummary[] {
  return teams.map((team) => ({
    name: team.name,
    memberNames: team.participantIds.map((participantId) => nameById.get(participantId) ?? participantId).join(', '),
  }))
}
