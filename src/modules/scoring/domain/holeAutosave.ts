import type { RoundCourseSource } from '@core/domain/round'

export type HoleDraftInputs = {
  parInput: string
  lengthInput: string
  scoreInputs: Record<string, string>
}

export type PersistedHoleState = {
  par: number | null
  lengthMeters: number | null
  participantScores: Record<string, { strokes: number; par: number } | undefined>
}

export type HoleAutosavePayload = {
  metadata: { par: string; lengthMeters: string } | null
  participantScoreUpdates: Array<{ participantUid: string; strokes: number; par: number }>
  hasMeaningfulChange: boolean
  validationError: string | null
  /** When only par changes on a saved-layout round (admin correction). */
  savedParSync: { par: number } | null
  /** When length changes on a saved-layout round (admin correction; writes the template doc). */
  savedLengthSync: { lengthMeters: number | null } | null
}

function parseIntegerInput(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null
  return Number(value)
}

function parseOptionalLengthInput(value: string): { ok: true; lengthMeters: number | null } | { ok: false } {
  const trimmed = value.trim()
  if (trimmed.length === 0) return { ok: true, lengthMeters: null }
  if (!/^\d+$/.test(trimmed)) return { ok: false }
  const n = Number(trimmed)
  if (!Number.isFinite(n) || n <= 0) return { ok: false }
  return { ok: true, lengthMeters: n }
}

export function clampHoleNumber(holeNumber: number, holeCount: number): number {
  const safeHoleCount =
    Number.isFinite(holeCount) && holeCount >= 1 ? Math.floor(holeCount) : 1
  if (!Number.isFinite(holeNumber)) return 1
  return Math.min(safeHoleCount, Math.max(1, Math.floor(holeNumber)))
}

export function stepHoleNumber(
  currentHoleNumber: number,
  direction: -1 | 1,
  holeCount: number,
): number {
  return clampHoleNumber(currentHoleNumber + direction, holeCount)
}

export function hasUnsavedHoleDraft(params: {
  courseSource: RoundCourseSource
  participantIds: string[]
  draft: HoleDraftInputs
  persisted: PersistedHoleState
  allowSavedMetadataAdjust?: boolean
}): boolean {
  return mergeAutosavePayload(params).hasMeaningfulChange
}

export function mergeAutosavePayload(params: {
  courseSource: RoundCourseSource
  participantIds: string[]
  draft: HoleDraftInputs
  persisted: PersistedHoleState
  /** When set (e.g. scramble), only persist scores for these roster ids. */
  scoreParticipantIds?: string[]
  /** When true, saved-layout rounds may sync par + length adjustments through the admin path. */
  allowSavedMetadataAdjust?: boolean
}): HoleAutosavePayload {
  const normalizedParInput = params.draft.parInput.trim()
  const normalizedLengthInput = params.draft.lengthInput.trim()
  const persistedParInput =
    typeof params.persisted.par === 'number' ? String(params.persisted.par) : ''
  const persistedLengthInput =
    typeof params.persisted.lengthMeters === 'number'
      ? String(params.persisted.lengthMeters)
      : ''

  const metadataChanged =
    params.courseSource === 'fresh' &&
    (normalizedParInput !== persistedParInput ||
      normalizedLengthInput !== persistedLengthInput)
  const metadata =
    params.courseSource === 'fresh' && metadataChanged
      ? { par: normalizedParInput, lengthMeters: normalizedLengthInput }
      : null

  const explicitParValue = parseIntegerInput(normalizedParInput)
  const participantScoreUpdates: Array<{
    participantUid: string
    strokes: number
    par: number
  }> = []

  const scoreParticipantIds = params.scoreParticipantIds ?? params.participantIds
  for (const participantUid of scoreParticipantIds) {
    const rawScoreInput = params.draft.scoreInputs[participantUid] ?? ''
    const trimmedScoreInput = rawScoreInput.trim()
    if (trimmedScoreInput.length === 0) continue

    const strokes = parseIntegerInput(trimmedScoreInput)
    if (strokes === null) {
      return {
        metadata,
        participantScoreUpdates: [],
        hasMeaningfulChange: false,
        validationError: `Score for ${participantUid} must be an integer.`,
        savedParSync: null,
        savedLengthSync: null,
      }
    }

    const persistedScore = params.persisted.participantScores[participantUid]
    const parForScore =
      explicitParValue ?? persistedScore?.par ?? params.persisted.par ?? null
    if (typeof parForScore !== 'number') {
      return {
        metadata,
        participantScoreUpdates: [],
        hasMeaningfulChange: false,
        validationError: `Set par before saving score for ${participantUid}.`,
        savedParSync: null,
        savedLengthSync: null,
      }
    }

    const scoreChanged =
      !persistedScore ||
      persistedScore.strokes !== strokes ||
      persistedScore.par !== parForScore
    if (scoreChanged) {
      participantScoreUpdates.push({
        participantUid,
        strokes,
        par: parForScore,
      })
    }
  }

  let savedParSync: { par: number } | null = null
  if (
    params.courseSource === 'saved' &&
    params.allowSavedMetadataAdjust &&
    explicitParValue !== null &&
    explicitParValue !== params.persisted.par &&
    participantScoreUpdates.length === 0
  ) {
    const hasAnyScore = params.participantIds.some(
      (participantUid) => params.persisted.participantScores[participantUid] !== undefined,
    )
    if (hasAnyScore) {
      savedParSync = { par: explicitParValue }
    }
  }

  let savedLengthSync: { lengthMeters: number | null } | null = null
  if (params.courseSource === 'saved' && params.allowSavedMetadataAdjust) {
    const parsedLength = parseOptionalLengthInput(normalizedLengthInput)
    const persistedLengthValue =
      typeof params.persisted.lengthMeters === 'number' ? params.persisted.lengthMeters : null
    if (parsedLength.ok && parsedLength.lengthMeters !== persistedLengthValue) {
      savedLengthSync = { lengthMeters: parsedLength.lengthMeters }
    }
  }

  return {
    metadata,
    participantScoreUpdates,
    hasMeaningfulChange: Boolean(
      metadataChanged ||
        participantScoreUpdates.length > 0 ||
        savedParSync !== null ||
        savedLengthSync !== null,
    ),
    validationError: null,
    savedParSync,
    savedLengthSync,
  }
}
