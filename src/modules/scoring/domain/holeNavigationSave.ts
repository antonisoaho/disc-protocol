import {
  clampHoleNumber,
  hasUnsavedHoleDraft,
  type HoleDraftInputs,
  type PersistedHoleState,
} from '@modules/scoring/domain/holeAutosave'
import type { RoundCourseSource } from '@core/domain/round'

export type BackgroundHoleSaveRequest = {
  holeNumber: number
  draft: HoleDraftInputs
  persisted: PersistedHoleState
}

/** Snapshot persist request when leaving a hole — always when draft exists (persist no-ops if unchanged). */
export function buildLeaveHolePersistRequest(params: {
  activeHoleNumber: number
  draft: HoleDraftInputs | null
  persisted: PersistedHoleState | null
}): BackgroundHoleSaveRequest | null {
  if (!params.draft || !params.persisted) {
    return null
  }
  return {
    holeNumber: params.activeHoleNumber,
    draft: params.draft,
    persisted: params.persisted,
  }
}

export function resolveBackgroundHoleSaveOnNavigate(params: {
  activeHoleNumber: number
  targetHoleNumber: number
  holeCount: number
  draft: HoleDraftInputs | null
  persisted: PersistedHoleState | null
  courseSource: RoundCourseSource
  participantIds: string[]
  allowSavedMetadataAdjust?: boolean
}): { nextHoleNumber: number; backgroundSave: BackgroundHoleSaveRequest | null } {
  const nextHoleNumber = clampHoleNumber(params.targetHoleNumber, params.holeCount)
  if (nextHoleNumber === params.activeHoleNumber || !params.draft || !params.persisted) {
    return { nextHoleNumber, backgroundSave: null }
  }

  const hasChange = hasUnsavedHoleDraft({
    courseSource: params.courseSource,
    participantIds: params.participantIds,
    draft: params.draft,
    persisted: params.persisted,
    allowSavedMetadataAdjust: params.allowSavedMetadataAdjust,
  })

  return {
    nextHoleNumber,
    backgroundSave: hasChange
      ? {
          holeNumber: params.activeHoleNumber,
          draft: params.draft,
          persisted: params.persisted,
        }
      : null,
  }
}
