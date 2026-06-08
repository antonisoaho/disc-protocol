import type { UserDirectoryEntry } from '@core/users/userDirectory'

export const SCORING_PANEL_ANONYMOUS_NAME_MAX_LENGTH = 80
export const SCORING_PANEL_NON_WHITESPACE_PATTERN = '.*\\S.*'

export function formatScoringDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : `${delta}`
}

export function parseScoringIntegerInput(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null
  return Number(value)
}

export function scoringParticipantDisplayName(entry: UserDirectoryEntry): string {
  return entry.displayName.trim().length > 0 ? entry.displayName : entry.uid
}
