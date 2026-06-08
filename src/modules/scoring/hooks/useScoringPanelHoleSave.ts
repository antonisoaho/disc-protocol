import {
  FreshRoundDraftValidationError,
} from '@core/domain/freshRoundCourse'
import {
  recordParticipantHoleScoresBatchTransaction,
  syncSavedRoundHoleLengthForHole,
  syncSavedRoundHoleParForHole,
  updateFreshRoundHoleMetadata,
} from '@core/domain/rounds'
import type { RoundDoc } from '@core/domain/round'
import { formatDraftIssues } from '@common/helpers/formatDraftIssues'
import { translateUserError } from '@common/i18n/translateError'
import { buildLeaveHolePersistRequest } from '@modules/scoring/domain/holeNavigationSave'
import {
  clampHoleNumber,
  mergeAutosavePayload,
  type HoleDraftInputs,
  type PersistedHoleState,
} from '@modules/scoring/domain/holeAutosave'
import { createHoleSaveScheduler } from '@modules/scoring/domain/holeSaveScheduling'
import {
  holeSaveRetryDelayMs,
  shouldRetryHoleSave,
  waitMs,
} from '@modules/scoring/domain/holeSaveRetry'
import { useDirtyHoleBackgroundSave } from '@modules/scoring/hooks/useDirtyHoleBackgroundSave'
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { TFunction } from 'i18next'

const HOLE_SAVE_CHAIN_MAX = 4

type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

type HoleSaveOptions = {
  holeNumber?: number
  draft?: HoleDraftInputs
  persisted?: PersistedHoleState
  background?: boolean
}

type Params = {
  roundId: string
  uid: string
  t: TFunction
  selected: { data: RoundDoc } | null
  selectedHoleCount: number | null
  activeHoleNumber: number
  setHoleNumber: Dispatch<SetStateAction<number>>
  persistedHoleState: PersistedHoleState | null
  defaultHoleDraft: HoleDraftInputs | null
  scoringParticipantIds: string[]
  canAdjustSavedCourseMetadata: boolean
  setError: Dispatch<SetStateAction<string | null>>
  setNotice: Dispatch<SetStateAction<string | null>>
}

export function useScoringPanelHoleSave({
  roundId,
  uid,
  t,
  selected,
  selectedHoleCount,
  activeHoleNumber,
  setHoleNumber,
  persistedHoleState,
  defaultHoleDraft,
  scoringParticipantIds,
  canAdjustSavedCourseMetadata,
  setError,
  setNotice,
}: Params) {
  const [holeDraft, setHoleDraft] = useState<HoleDraftInputs | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('saved')

  const holeSaveSchedulerRef = useRef(createHoleSaveScheduler())
  const holeDraftRef = useRef<HoleDraftInputs | null>(null)
  const persistedHoleStateRef = useRef<PersistedHoleState | null>(null)
  const activeHoleNumberRef = useRef(activeHoleNumber)
  const saveStateRef = useRef<SaveState>('saved')
  const saveRetryAttemptRef = useRef(0)

  const effectiveHoleDraft = holeDraft ?? defaultHoleDraft
  const isSaving = saveState === 'saving'

  const holeFormSaveStatusLabel = useMemo(() => {
    if (saveState === 'dirty') {
      return t('scoring.saveState.unsavedChanges')
    }
    if (saveState === 'error') {
      return t('scoring.saveState.saveFailed')
    }
    return undefined
  }, [saveState, t])

  useEffect(() => {
    holeDraftRef.current = effectiveHoleDraft
  }, [effectiveHoleDraft])

  useEffect(() => {
    saveStateRef.current = saveState
  }, [saveState])

  useEffect(() => {
    activeHoleNumberRef.current = activeHoleNumber
  }, [activeHoleNumber])

  useEffect(() => {
    persistedHoleStateRef.current = persistedHoleState
  }, [persistedHoleState])

  const updateHoleDraft = useCallback(
    (updater: (current: HoleDraftInputs) => HoleDraftInputs) => {
      setHoleDraft((current) => {
        const base = current ?? holeDraftRef.current ?? defaultHoleDraft
        if (!base) return current
        const next = updater(base)
        holeDraftRef.current = next
        return next
      })
      setSaveState('dirty')
      setNotice(null)
    },
    [defaultHoleDraft, setNotice],
  )

  const persistHoleDraftOnce = useCallback(
    async (options?: HoleSaveOptions): Promise<boolean> => {
      if (!selected || !roundId) return true
      const targetHoleNumber = options?.holeNumber ?? activeHoleNumber
      const persisted = options?.persisted ?? persistedHoleState
      const draft = options?.draft ?? holeDraftRef.current
      const background = options?.background === true
      if (!persisted || !draft) return true

      const roundCourseSource = selected.data.courseSource ?? 'saved'
      const payload = mergeAutosavePayload({
        courseSource: roundCourseSource,
        participantIds: selected.data.participantIds,
        scoreParticipantIds: scoringParticipantIds,
        draft,
        persisted,
        allowSavedMetadataAdjust: canAdjustSavedCourseMetadata,
      })

      if (payload.validationError) {
        setError(payload.validationError)
        setSaveState('error')
        return false
      }

      if (!payload.hasMeaningfulChange) {
        return true
      }

      if (!background) {
        setSaveState('saving')
      }
      setError(null)

      for (let attempt = 0; shouldRetryHoleSave(attempt); attempt += 1) {
        if (attempt > 0) {
          await waitMs(holeSaveRetryDelayMs(attempt))
        }
        try {
          if (roundCourseSource === 'fresh' && payload.metadata) {
            await updateFreshRoundHoleMetadata({
              roundId,
              actorUid: uid,
              holeNumber: targetHoleNumber,
              metadata: payload.metadata,
            })
          }
          if (payload.savedParSync) {
            await syncSavedRoundHoleParForHole({
              roundId,
              actorUid: uid,
              holeNumber: targetHoleNumber,
              par: payload.savedParSync.par,
            })
          }
          if (payload.savedLengthSync) {
            await syncSavedRoundHoleLengthForHole({
              roundId,
              actorUid: uid,
              holeNumber: targetHoleNumber,
              lengthMeters: payload.savedLengthSync.lengthMeters,
            })
          }
          await recordParticipantHoleScoresBatchTransaction(
            roundId,
            uid,
            payload.participantScoreUpdates.map((update) => ({
              participantUid: update.participantUid,
              holeNumber: targetHoleNumber,
              strokes: update.strokes,
              par: update.par,
            })),
          )
          saveRetryAttemptRef.current = 0
          if (!background || activeHoleNumberRef.current === targetHoleNumber) {
            setSaveState('saved')
          }
          return true
        } catch (nextError) {
          saveRetryAttemptRef.current = attempt + 1
          if (!shouldRetryHoleSave(attempt + 1)) {
            if (nextError instanceof FreshRoundDraftValidationError) {
              setError(formatDraftIssues(t, nextError.issues))
            } else {
              setError(
                nextError instanceof Error
                  ? translateUserError(t, nextError.message)
                  : t('scoring.errors.failedToAutosaveHole'),
              )
            }
            setSaveState('error')
            return false
          }
        }
      }

      setSaveState('error')
      return false
    },
    [
      activeHoleNumber,
      canAdjustSavedCourseMetadata,
      persistedHoleState,
      roundId,
      scoringParticipantIds,
      selected,
      setError,
      t,
      uid,
    ],
  )

  const runHoleSave = useCallback(
    (holeNumber: number, run: () => Promise<boolean>) =>
      holeSaveSchedulerRef.current.run(holeNumber, run),
    [],
  )

  const saveCurrentHole = useCallback(async (): Promise<boolean> => {
    return runHoleSave(activeHoleNumber, async () => {
      for (let pass = 0; pass < HOLE_SAVE_CHAIN_MAX; pass += 1) {
        const draftBeforeSave = holeDraftRef.current
        if (!draftBeforeSave) {
          setSaveState('saved')
          return true
        }
        const savedDraftFingerprint = JSON.stringify(draftBeforeSave)
        const saved = await persistHoleDraftOnce()
        if (!saved) {
          return false
        }
        const draftAfterSave = holeDraftRef.current
        if (!draftAfterSave || JSON.stringify(draftAfterSave) === savedDraftFingerprint) {
          setSaveState('saved')
          return true
        }
      }
      setSaveState('dirty')
      return true
    })
  }, [activeHoleNumber, persistHoleDraftOnce, runHoleSave])

  const flushAndSaveHole = useCallback(
    async (options?: HoleSaveOptions): Promise<boolean> => {
      if (options?.background && options.holeNumber !== undefined) {
        return runHoleSave(options.holeNumber, () => persistHoleDraftOnce(options))
      }
      return saveCurrentHole()
    },
    [persistHoleDraftOnce, runHoleSave, saveCurrentHole],
  )

  useDirtyHoleBackgroundSave({
    saveStateRef,
    holeDraftRef,
    persistedHoleStateRef,
    activeHoleNumberRef,
    runHoleSave,
    persistHoleDraftOnce,
  })

  const leaveHole = useCallback(
    async (targetHoleNumber: number): Promise<boolean> => {
      if (!selectedHoleCount || !selected || !persistedHoleState) return false
      const nextHoleNumber = clampHoleNumber(targetHoleNumber, selectedHoleCount)
      const persistRequest = buildLeaveHolePersistRequest({
        activeHoleNumber,
        draft: holeDraftRef.current,
        persisted: persistedHoleState,
      })

      if (persistRequest) {
        const saved = await runHoleSave(persistRequest.holeNumber, () =>
          persistHoleDraftOnce({
            holeNumber: persistRequest.holeNumber,
            draft: persistRequest.draft,
            persisted: persistRequest.persisted,
            background: false,
          }),
        )
        if (!saved) {
          return false
        }
      }

      if (nextHoleNumber === activeHoleNumber) {
        return true
      }

      setHoleNumber(nextHoleNumber)
      setHoleDraft(null)
      setSaveState('saved')
      setNotice(null)
      return true
    },
    [
      activeHoleNumber,
      persistHoleDraftOnce,
      persistedHoleState,
      runHoleSave,
      selected,
      selectedHoleCount,
      setHoleNumber,
      setNotice,
    ],
  )

  const resetHoleDraft = useCallback(() => {
    setHoleDraft(null)
    setSaveState('saved')
  }, [])

  return {
    effectiveHoleDraft,
    saveState,
    isSaving,
    holeFormSaveStatusLabel,
    updateHoleDraft,
    flushAndSaveHole,
    leaveHole,
    resetHoleDraft,
  }
}
