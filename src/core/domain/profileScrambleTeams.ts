import {
  createRoundTeamId,
  isRoundTeamId,
  normalizeRoundTeams,
  type RoundTeam,
} from '@core/domain/roundTeams'

export const PROFILE_TEAM_PRESET_PREFIX = 'preset:'

export type ProfileScrambleTeamPreset = {
  id: string
  name: string
  memberUids: string[]
}

export type AggregatedScrambleTeamPreset = {
  ownerUid: string
  preset: ProfileScrambleTeamPreset
}

export function isProfileTeamPresetId(value: string): boolean {
  return value.trim().startsWith(PROFILE_TEAM_PRESET_PREFIX)
}

export function createProfileTeamPresetId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${PROFILE_TEAM_PRESET_PREFIX}${globalThis.crypto.randomUUID()}`
  }
  const randomSuffix = Math.random().toString(36).slice(2, 10)
  return `${PROFILE_TEAM_PRESET_PREFIX}${randomSuffix}`
}

/** Teams visible on Profile: admins see every preset; others only teams they belong to. */
export function filterVisibleAggregatedTeamPresets(
  entries: AggregatedScrambleTeamPreset[],
  viewerUid: string,
  isAdmin: boolean,
): AggregatedScrambleTeamPreset[] {
  if (isAdmin) {
    return entries
  }
  return entries.filter((entry) => entry.preset.memberUids.includes(viewerUid))
}

export function isAggregatedTeamPresetEditable(
  entry: AggregatedScrambleTeamPreset,
  viewerUid: string,
  isAdmin: boolean,
): boolean {
  return isAdmin || entry.ownerUid === viewerUid
}

/** Keeps presets the viewer cannot edit when saving a partial update. */
export function mergeProfileTeamPresetSave(
  existing: ProfileScrambleTeamPreset[],
  nextVisible: ProfileScrambleTeamPreset[],
  editablePresetIds: ReadonlySet<string>,
): ProfileScrambleTeamPreset[] {
  const hidden = existing.filter((preset) => !editablePresetIds.has(preset.id))
  return normalizeProfileScrambleTeamPresets([...hidden, ...nextVisible])
}

export function normalizeProfileScrambleTeamPresets(
  presets: ProfileScrambleTeamPreset[] | null | undefined,
): ProfileScrambleTeamPreset[] {
  const claimed = new Set<string>()
  const normalized: ProfileScrambleTeamPreset[] = []

  for (const preset of presets ?? []) {
    const id = preset.id?.trim() ?? ''
    const name = preset.name?.trim() ?? ''
    if (!isProfileTeamPresetId(id) || name.length === 0) {
      continue
    }

    const memberUids: string[] = []
    for (const memberUid of preset.memberUids ?? []) {
      const normalizedUid = memberUid.trim()
      if (normalizedUid.length === 0 || claimed.has(normalizedUid)) {
        continue
      }
      claimed.add(normalizedUid)
      memberUids.push(normalizedUid)
    }

    normalized.push({ id, name, memberUids })
  }

  return normalized
}

/** Maps saved profile presets onto a round roster (only members who are playing). */
export function applyProfileTeamsToRound(
  participantIds: string[],
  presets: ProfileScrambleTeamPreset[] | null | undefined,
): RoundTeam[] {
  const participantSet = new Set(participantIds)
  const roundTeams: RoundTeam[] = []

  for (const preset of normalizeProfileScrambleTeamPresets(presets)) {
    const participantIdsForTeam = preset.memberUids.filter((memberUid) => participantSet.has(memberUid))
    if (participantIdsForTeam.length === 0) {
      continue
    }
    roundTeams.push({
      id: createRoundTeamId(),
      name: preset.name,
      participantIds: participantIdsForTeam,
    })
  }

  return normalizeRoundTeams(participantIds, roundTeams)
}

function isWizardTeamId(value: string): boolean {
  return isProfileTeamPresetId(value) || isRoundTeamId(value)
}

/** Keeps wizard/editor teams aligned with the current roster. */
export function normalizeWizardTeams(
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
    if (!isWizardTeamId(id) || name.length === 0) {
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

    normalized.push({ id, name, participantIds: members })
  }

  return normalized
}

/** Maps saved profile presets onto the wizard roster (keeps preset ids). */
export function presetsToWizardTeams(
  participantIds: string[],
  presets: ProfileScrambleTeamPreset[] | null | undefined,
): RoundTeam[] {
  const participantSet = new Set(participantIds)
  const wizardTeams: RoundTeam[] = []

  for (const preset of normalizeProfileScrambleTeamPresets(presets)) {
    const participantIdsForTeam = preset.memberUids.filter((memberUid) => participantSet.has(memberUid))
    if (participantIdsForTeam.length === 0) {
      continue
    }
    wizardTeams.push({
      id: preset.id,
      name: preset.name,
      participantIds: participantIdsForTeam,
    })
  }

  return normalizeWizardTeams(participantIds, wizardTeams)
}

/** Persists wizard teams back to profile presets. */
export function wizardTeamsToPresets(teams: RoundTeam[]): ProfileScrambleTeamPreset[] {
  return teams.map((team) => ({
    id: isProfileTeamPresetId(team.id) ? team.id : createProfileTeamPresetId(),
    name: team.name.trim(),
    memberUids: [...team.participantIds],
  }))
}

/** Snapshot wizard teams onto a new round document. */
export function roundTeamsFromWizard(
  participantIds: string[],
  wizardTeams: RoundTeam[] | null | undefined,
): RoundTeam[] {
  const normalized = normalizeWizardTeams(participantIds, wizardTeams)
  const roundTeams = normalized.map((team) => ({
    id: createRoundTeamId(),
    name: team.name,
    participantIds: team.participantIds,
  }))
  return normalizeRoundTeams(participantIds, roundTeams)
}
