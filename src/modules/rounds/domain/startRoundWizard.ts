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

export type WizardScoringMode = 'individual' | 'scramble'

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

export function resolveParticipantDisplayName(
  participantId: string,
  nameById: ReadonlyMap<string, string>,
  unknownLabel: string,
): string {
  const resolved = nameById.get(participantId)?.trim()
  return resolved && resolved.length > 0 ? resolved : unknownLabel
}

export function buildParticipantNameById<DirectoryEntry extends { uid: string; displayName: string }>(params: {
  directoryEntries: ReadonlyArray<DirectoryEntry>
  ownerUid: string
  ownerDisplayName: string
  anonymousParticipants: ReadonlyArray<{ id: string; displayName: string }>
  resolveDirectoryName?: (entry: DirectoryEntry) => string
}): Map<string, string> {
  const resolveName =
    params.resolveDirectoryName ??
    ((entry: DirectoryEntry) => (entry.displayName.trim().length > 0 ? entry.displayName : entry.uid))
  const map = new Map<string, string>()
  for (const entry of params.directoryEntries) {
    map.set(entry.uid, resolveName(entry))
  }
  map.set(params.ownerUid, params.ownerDisplayName)
  for (const participant of params.anonymousParticipants) {
    map.set(participant.id, participant.displayName)
  }
  return map
}

export function buildSavedTeamPresetSummaries(
  presets: ProfileScrambleTeamPreset[],
  participantIds: string[],
  nameById: ReadonlyMap<string, string>,
  unknownLabel: string,
): SavedTeamPresetSummary[] {
  const roster = new Set(participantIds)
  return presets.map((preset) => {
    const rosterMemberIds = preset.memberUids.filter((memberUid) => roster.has(memberUid))
    const memberNames = preset.memberUids
      .map((memberUid) => resolveParticipantDisplayName(memberUid, nameById, unknownLabel))
      .join(', ')
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
  unknownLabel: string,
): ReviewTeamSummary[] {
  return teams.map((team) => ({
    name: team.name,
    memberNames: team.participantIds
      .map((participantId) => resolveParticipantDisplayName(participantId, nameById, unknownLabel))
      .join(', '),
  }))
}
