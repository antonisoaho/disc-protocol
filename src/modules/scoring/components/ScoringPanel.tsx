import { type User } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@core/auth/useAuth'
import type { CourseTemplateDoc } from '@core/domain/course'
import { db } from '@core/firebase/firestore'
import { COLLECTIONS } from '@core/firebase/paths'
import { translateUserError } from '@common/i18n/translateError'
import {
  FreshRoundDraftValidationError,
  normalizeFreshCourseDraftForPromotion,
} from '@core/domain/freshRoundCourse'
import {
  addAnonymousParticipantToRound,
  addParticipantToRound,
  completeRoundAndPromote,
  deleteRound,
  removeParticipantFromRound,
  replaceRoundParticipant,
  subscribeMyRounds,
} from '@core/domain/rounds'
import type { RoundDoc } from '@core/domain/round'
import { subscribeFollowers, subscribeFollowing } from '@core/users/follows'
import { subscribeUserDirectory, type UserDirectoryEntry } from '@core/users/userDirectory'
import { formatDraftIssues } from '@common/helpers/formatDraftIssues'
import {
  buildAnonymousParticipantNameMap,
  createAnonymousParticipantId,
  deriveFriendUidSet,
  filterParticipantDirectoryEntries,
  normalizeAnonymousParticipantName,
} from '@core/domain/participantRoster'
import { ScoringPanelParticipantsTab } from '@modules/scoring/components/ScoringPanelParticipantsTab'
import { ScoringPanelResultsTab } from '@modules/scoring/components/ScoringPanelResultsTab'
import { ScoringPanelScorecardTab } from '@modules/scoring/components/ScoringPanelScorecardTab'
import { clampHoleNumber, stepHoleNumber } from '@modules/scoring/domain/holeAutosave'
import { resolveHoleSubmitMode } from '@modules/scoring/domain/holeSubmit'
import { buildRoundResultUnits } from '@modules/scoring/domain/buildRoundResultStandings'
import { isScrambleRound, resolveScrambleGridRows } from '@core/domain/scrambleScoring'
import { normalizeRoundTeams } from '@core/domain/roundTeams'
import { aggregateScoreProtocol, normalizeScoreProtocol } from '@core/domain/scoreProtocol'
import { inferRoundHoleCount } from '@core/domain/inferRoundHoleCount'
import {
  computeGrandTotals,
  computeParticipantTotals,
  countFullyScoredHoles,
} from '@core/domain/scorecardTable'
import { buildRoundHoleMetadataByNumber } from '@modules/scoring/domain/buildRoundHoleMetadata'
import { resolveHonorDisplayLabel } from '@modules/scoring/domain/resolveHonorThrowerUid'
import {
  SCORING_PANEL_ANONYMOUS_NAME_MAX_LENGTH,
  scoringParticipantDisplayName,
} from '@modules/scoring/domain/scoringPanelFormat'
import { useScoringPanelHoleSave } from '@modules/scoring/hooks/useScoringPanelHoleSave'

type Props = {
  user: User
  roundId: string
  onAfterRoundDeleted?: () => void
}

type AppTabId = 'scorecard' | 'results' | 'participants'

function readParticipantHoleScores(data: RoundDoc, fallbackUid: string) {
  const next: Record<string, Record<string, { strokes: number; par: number }>> = {}
  const participantIdSet = new Set(data.participantIds)

  for (const participantId of data.participantIds) {
    next[participantId] = {}
  }

  if (data.participantHoleScores && Object.keys(data.participantHoleScores).length > 0) {
    for (const [participantId, holeMap] of Object.entries(data.participantHoleScores)) {
      next[participantId] = next[participantId] ?? {}
      for (const [holeKey, score] of Object.entries(holeMap)) {
        next[participantId][holeKey] = {
          strokes: score.strokes,
          par: score.par,
        }
      }
    }
    return next
  }

  for (const [holeKey, score] of Object.entries(data.holeScores ?? {})) {
    const owner =
      typeof score.updatedBy === 'string' && participantIdSet.has(score.updatedBy)
        ? score.updatedBy
        : fallbackUid
    next[owner] = next[owner] ?? {}
    next[owner][holeKey] = {
      strokes: score.strokes,
      par: score.par,
    }
  }

  return next
}

export function ScoringPanel({ user, roundId, onAfterRoundDeleted }: Props) {
  const { t } = useTranslation('common')
  const { isAdmin } = useAuth()
  const uid = user.uid
  const [activeTab, setActiveTab] = useState<AppTabId>('scorecard')
  const [listSnapshotSeen, setListSnapshotSeen] = useState(false)
  const [items, setItems] = useState<{ id: string; data: RoundDoc }[]>([])
  const [inviteAnonymousNameError, setInviteAnonymousNameError] = useState<string | null>(null)
  const [inviteParticipantQuery, setInviteParticipantQuery] = useState('')
  const [inviteAnonymousName, setInviteAnonymousName] = useState('')
  const [inviteSelections, setInviteSelections] = useState<string[]>([])
  const [rosterReplaceFromId, setRosterReplaceFromId] = useState<string | null>(null)
  const [rosterReplaceQuery, setRosterReplaceQuery] = useState('')
  const [rosterReplaceTargetUid, setRosterReplaceTargetUid] = useState<string | null>(null)
  const [directoryEntries, setDirectoryEntries] = useState<UserDirectoryEntry[]>([])
  const [followingIds, setFollowingIds] = useState<string[]>([])
  const [followerIds, setFollowerIds] = useState<string[]>([])
  const [holeNumber, setHoleNumber] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const inviteAnonymousNameInputRef = useRef<HTMLInputElement | null>(null)

  const resolveAnonymousNameError = useCallback(
    (input: HTMLInputElement): string => {
      if (input.validity.valueMissing || input.validity.patternMismatch) {
        return t('scoring.messages.anonymousNameRequired')
      }
      if (input.validity.tooLong) {
        return t('scoring.messages.anonymousNameTooLong', {
          max: SCORING_PANEL_ANONYMOUS_NAME_MAX_LENGTH,
        })
      }
      return input.validationMessage || t('scoring.messages.anonymousNameRequired')
    },
    [t],
  )

  useEffect(() => {
    const unsub = subscribeMyRounds(
      uid,
      (next) => {
        setError(null)
        setItems(next)
        setListSnapshotSeen(true)
      },
      (nextError) => setError(translateUserError(t, nextError.message)),
    )
    return () => unsub()
  }, [t, uid])

  useEffect(() => {
    const unsub = subscribeUserDirectory(
      (entries) => setDirectoryEntries(entries),
      () => {
        // Directory listing can be hidden by rules; owner-only fallback still works.
      },
    )
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = subscribeFollowing(
      uid,
      (edges) => {
        setFollowingIds(Array.from(new Set(edges.map((edge) => edge.followeeUid))))
      },
      () => {
        // Friends fallback becomes empty if follows read is unavailable.
      },
    )
    return () => unsub()
  }, [uid])

  useEffect(() => {
    const unsub = subscribeFollowers(
      uid,
      (edges) => {
        setFollowerIds(Array.from(new Set(edges.map((edge) => edge.followerUid))))
      },
      () => {
        // Friends fallback becomes empty if follows read is unavailable.
      },
    )
    return () => unsub()
  }, [uid])

  const selected = useMemo(() => items.find((round) => round.id === roundId) ?? null, [items, roundId])

  const roundMissingAfterSync = listSnapshotSeen && !items.some((row) => row.id === roundId)

  const canManageRoundRoster = useMemo(() => {
    if (!selected) return false
    return selected.data.ownerId === uid || isAdmin
  }, [isAdmin, selected, uid])

  const canAdjustSavedCourseMetadata = useMemo(() => {
    if (!selected || selected.data.courseSource !== 'saved') return false
    return isAdmin
  }, [isAdmin, selected])

  const savedCourseMetadataLocked = useMemo(() => {
    if (!selected || selected.data.courseSource !== 'saved') return false
    return !canAdjustSavedCourseMetadata
  }, [canAdjustSavedCourseMetadata, selected])

  const [layoutTemplateDoc, setLayoutTemplateDoc] = useState<CourseTemplateDoc | null>(null)

  useEffect(() => {
    if (!selected || selected.data.courseSource !== 'saved') {
      queueMicrotask(() => setLayoutTemplateDoc(null))
      return
    }
    const { courseId, templateId } = selected.data
    const cref = doc(db, COLLECTIONS.courses, courseId, COLLECTIONS.templates, templateId)
    return onSnapshot(cref, (snap) => {
      queueMicrotask(() => {
        setLayoutTemplateDoc(snap.exists() ? (snap.data() as CourseTemplateDoc) : null)
      })
    })
    // Intentionally depend on layout ids only so we do not re-subscribe on every live round score update.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selected is read only for the branch above; deps track layout identity.
  }, [selected?.data.courseId, selected?.data.courseSource, selected?.data.templateId, selected?.id])

  const selectedHoleCount = useMemo(
    () => (selected ? inferRoundHoleCount(selected.data) : null),
    [selected],
  )
  const activeHoleNumber = selectedHoleCount ? clampHoleNumber(holeNumber, selectedHoleCount) : 1

  const directoryByUid = useMemo(() => {
    const map: Record<string, UserDirectoryEntry> = {}
    for (const entry of directoryEntries) {
      map[entry.uid] = entry
    }
    if (!map[uid]) {
      map[uid] = {
        uid,
        displayName: user.displayName?.trim() || user.email?.split('@')[0] || t('social.youFallback'),
        subtitle: uid,
      }
    }
    return map
  }, [directoryEntries, t, uid, user.displayName, user.email])

  const allDirectoryEntries = useMemo(
    () =>
      Object.values(directoryByUid).sort((a, b) =>
        scoringParticipantDisplayName(a).localeCompare(scoringParticipantDisplayName(b), undefined, {
          sensitivity: 'base',
        }),
      ),
    [directoryByUid],
  )

  const friendUidSet = useMemo(() => deriveFriendUidSet(followingIds, followerIds), [followerIds, followingIds])

  const searchableDirectoryEntries = useMemo(
    () => allDirectoryEntries.filter((entry) => entry.uid !== uid),
    [allDirectoryEntries, uid],
  )

  const inviteCandidateEntries = useMemo(() => {
    if (!selected) return []
    const filtered = filterParticipantDirectoryEntries({
      entries: searchableDirectoryEntries,
      query: inviteParticipantQuery,
      friendUidSet,
    })
    return filtered.filter((entry) => !selected.data.participantIds.includes(entry.uid))
  }, [friendUidSet, inviteParticipantQuery, searchableDirectoryEntries, selected])

  const rosterReplaceCandidateEntries = useMemo(() => {
    if (!selected || !rosterReplaceFromId) return []
    const filtered = filterParticipantDirectoryEntries({
      entries: searchableDirectoryEntries,
      query: rosterReplaceQuery,
      friendUidSet,
    })
    return filtered.filter((entry) => !selected.data.participantIds.includes(entry.uid))
  }, [friendUidSet, rosterReplaceFromId, rosterReplaceQuery, searchableDirectoryEntries, selected])

  const clearRosterReplaceFlow = useCallback(() => {
    setRosterReplaceFromId(null)
    setRosterReplaceQuery('')
    setRosterReplaceTargetUid(null)
  }, [])

  const selectedParticipantScores = useMemo(
    () => (selected ? readParticipantHoleScores(selected.data, uid) : null),
    [selected, uid],
  )

  const selectedAnonymousNameMap = useMemo(
    () => buildAnonymousParticipantNameMap(selected?.data.anonymousParticipants ?? []),
    [selected],
  )

  const selectedParticipantNames = useMemo(() => {
    if (!selected) return {}
    const names: Record<string, string> = {}
    for (const participantId of selected.data.participantIds) {
      const anonymousDisplayName = selectedAnonymousNameMap[participantId]
      if (anonymousDisplayName) {
        names[participantId] = anonymousDisplayName
        continue
      }
      names[participantId] = scoringParticipantDisplayName(
        directoryByUid[participantId] ?? {
          uid: participantId,
          displayName: participantId,
          subtitle: participantId,
        },
      )
    }
    return names
  }, [directoryByUid, selected, selectedAnonymousNameMap])

  const selectedScrambleTeams = useMemo(() => {
    if (!selected) return []
    return normalizeRoundTeams(selected.data.participantIds, selected.data.teams)
  }, [selected])

  const isScrambleScoring = useMemo(
    () => (selected ? isScrambleRound(selected.data.participantIds, selected.data) : false),
    [selected],
  )

  const currentUserHoleScores = useMemo(() => {
    if (!selected || !selectedParticipantScores) return {}
    return selectedParticipantScores[uid] ?? {}
  }, [selected, selectedParticipantScores, uid])

  const selectedSummary = useMemo(() => {
    if (!selected) return null
    try {
      const protocol = normalizeScoreProtocol({
        version: selected.data.scoreProtocolVersion,
        holeCount: inferRoundHoleCount(selected.data),
        holeScores: currentUserHoleScores,
      })
      return aggregateScoreProtocol(protocol)
    } catch {
      return null
    }
  }, [currentUserHoleScores, selected])

  const selectedParticipantTotals = useMemo(() => {
    if (!selected || !selectedParticipantScores) return {}
    return computeParticipantTotals(selected.data.participantIds, selectedParticipantScores)
  }, [selected, selectedParticipantScores])

  const honorHint = useMemo(() => {
    if (!selected || !selectedParticipantScores) return null
    const honorLabel = resolveHonorDisplayLabel({
      participantIds: selected.data.participantIds,
      scores: selectedParticipantScores,
      activeHoleNumber,
      participantNames: selectedParticipantNames,
      isScramble: isScrambleScoring,
      teams: selectedScrambleTeams,
    })
    if (!honorLabel) return null
    return t('scoring.stepper.honorThrowFirst', { names: honorLabel })
  }, [
    activeHoleNumber,
    isScrambleScoring,
    selected,
    selectedParticipantNames,
    selectedParticipantScores,
    selectedScrambleTeams,
    t,
  ])

  const selectedGrandTotals = useMemo(
    () => computeGrandTotals(selectedParticipantTotals),
    [selectedParticipantTotals],
  )

  const fullyScoredHoles = useMemo(() => {
    if (!selected || !selectedParticipantScores || !selectedHoleCount) {
      return 0
    }
    const scrambleRows = isScrambleScoring
      ? resolveScrambleGridRows({
          participantIds: selected.data.participantIds,
          teams: selectedScrambleTeams,
          participantNames: selectedParticipantNames,
        })
      : null
    const requiredScoreParticipantIds = scrambleRows
      ? scrambleRows.map((row) => row.scoreParticipantId)
      : selected.data.participantIds
    return countFullyScoredHoles({
      holeCount: selectedHoleCount,
      scoresByParticipant: selectedParticipantScores,
      requiredScoreParticipantIds,
    })
  }, [
    isScrambleScoring,
    selected,
    selectedHoleCount,
    selectedParticipantNames,
    selectedParticipantScores,
    selectedScrambleTeams,
  ])

  const scoringParticipantIds = useMemo(() => {
    if (!selected) {
      return []
    }
    const scrambleRows = isScrambleScoring
      ? resolveScrambleGridRows({
          participantIds: selected.data.participantIds,
          teams: selectedScrambleTeams,
          participantNames: selectedParticipantNames,
        })
      : null
    return scrambleRows
      ? scrambleRows.map((row) => row.scoreParticipantId)
      : selected.data.participantIds
  }, [isScrambleScoring, selected, selectedParticipantNames, selectedScrambleTeams])

  const selectedHoleMetadataByNumber = useMemo(() => {
    if (!selected || !selectedHoleCount) {
      return {}
    }
    return buildRoundHoleMetadataByNumber({
      holeCount: selectedHoleCount,
      courseSource: selected.data.courseSource,
      courseDraftHoles: selected.data.courseDraft?.holes,
      layoutHoles: layoutTemplateDoc?.holes,
      scoresByParticipant: selectedParticipantScores ?? {},
      participantIds: selected.data.participantIds,
    })
  }, [
    layoutTemplateDoc?.holes,
    selected,
    selectedHoleCount,
    selectedParticipantScores,
  ])

  const selectedFreshHoleByNumber = useMemo(() => {
    const map: Record<number, { number: number; par?: number | null; lengthMeters?: number | null }> = {}
    if (!selected || selected.data.courseSource !== 'fresh') {
      return map
    }
    for (const hole of selected.data.courseDraft?.holes ?? []) {
      map[hole.number] = hole
    }
    return map
  }, [selected])

  const selectedSavedParByHole = useMemo(() => {
    const map: Record<number, number> = {}
    if (!selected || selected.data.courseSource !== 'saved' || !selectedParticipantScores) {
      return map
    }
    for (const participantId of selected.data.participantIds) {
      const holeMap = selectedParticipantScores[participantId] ?? {}
      for (const [holeKey, score] of Object.entries(holeMap)) {
        const parsedHole = Number(holeKey)
        if (!Number.isInteger(parsedHole) || parsedHole < 1) continue
        if (typeof map[parsedHole] === 'number') continue
        map[parsedHole] = score.par
      }
    }
    return map
  }, [selected, selectedParticipantScores])

  const persistedHoleState = useMemo(() => {
    if (!selected || !selectedParticipantScores) return null
    const holeKey = String(activeHoleNumber)
    const roundCourseSource = selected.data.courseSource ?? 'saved'
    const firstScorePar = selected.data.participantIds
      .map((participantId) => selectedParticipantScores[participantId]?.[holeKey]?.par)
      .find((value) => typeof value === 'number')
    const freshHole = selectedFreshHoleByNumber[activeHoleNumber]
    const layoutHole =
      roundCourseSource === 'saved' && layoutTemplateDoc?.holes
        ? layoutTemplateDoc.holes[activeHoleNumber - 1]
        : undefined
    const parValue =
      roundCourseSource === 'fresh'
        ? (typeof freshHole?.par === 'number' ? freshHole.par : (firstScorePar ?? null))
        : typeof layoutHole?.par === 'number'
          ? layoutHole.par
          : (selectedSavedParByHole[activeHoleNumber] ?? (firstScorePar ?? null))
    const lengthMeters =
      roundCourseSource === 'fresh' && typeof freshHole?.lengthMeters === 'number'
        ? freshHole.lengthMeters
        : roundCourseSource === 'saved' && typeof layoutHole?.lengthMeters === 'number'
          ? layoutHole.lengthMeters
          : null
    const participantScores: Record<string, { strokes: number; par: number } | undefined> = {}
    for (const participantId of selected.data.participantIds) {
      participantScores[participantId] = selectedParticipantScores[participantId]?.[holeKey]
    }
    return {
      par: parValue,
      lengthMeters,
      participantScores,
    }
  }, [
    activeHoleNumber,
    selected,
    layoutTemplateDoc,
    selectedFreshHoleByNumber,
    selectedParticipantScores,
    selectedSavedParByHole,
  ])

  const defaultHoleDraft = useMemo(() => {
    if (!selected || !persistedHoleState) return null
    const nextScoreInputs: Record<string, string> = {}
    for (const participantId of selected.data.participantIds) {
      const score = persistedHoleState.participantScores[participantId]
      nextScoreInputs[participantId] = score ? String(score.strokes) : ''
    }
    return {
      parInput: typeof persistedHoleState.par === 'number' ? String(persistedHoleState.par) : '',
      lengthInput:
        typeof persistedHoleState.lengthMeters === 'number'
          ? String(persistedHoleState.lengthMeters)
          : '',
      scoreInputs: nextScoreInputs,
    }
  }, [persistedHoleState, selected])

  const {
    effectiveHoleDraft,
    saveState,
    isSaving,
    holeFormSaveStatusLabel,
    updateHoleDraft,
    flushAndSaveHole,
    leaveHole,
    resetHoleDraft,
  } = useScoringPanelHoleSave({
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
  })

  const onAddParticipant = useCallback(async () => {
    if (!roundId || !selected) return
    const inviteInput = inviteAnonymousNameInputRef.current
    if (inviteInput) {
      inviteInput.setCustomValidity('')
      if (!inviteInput.checkValidity()) {
        setInviteAnonymousNameError(resolveAnonymousNameError(inviteInput))
        return
      }
    }
    const normalizedAnonymousName = normalizeAnonymousParticipantName(inviteAnonymousName)
    const shouldAddAnonymous = normalizedAnonymousName.length > 0
    if (inviteSelections.length === 0 && !shouldAddAnonymous) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const anonymousParticipant = shouldAddAnonymous
        ? {
            id: createAnonymousParticipantId(),
            displayName: normalizedAnonymousName,
          }
        : null
      await Promise.all([
        ...inviteSelections.map((participantUid) => addParticipantToRound(roundId, participantUid)),
        ...(anonymousParticipant
          ? [
              addAnonymousParticipantToRound({
                roundId: roundId,
                actorUid: uid,
                participant: anonymousParticipant,
              }),
            ]
          : []),
      ])
      setInviteSelections([])
      setInviteAnonymousName('')
      setInviteAnonymousNameError(null)
      const totalAdded = inviteSelections.length + (anonymousParticipant ? 1 : 0)
      setNotice(
        totalAdded === 1
          ? t('scoring.messages.participantAdded')
          : t('scoring.messages.participantsAdded', { count: totalAdded }),
      )
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? translateUserError(t, nextError.message)
          : t('scoring.errors.failedToAddParticipant'),
      )
    } finally {
      setBusy(false)
    }
  }, [inviteAnonymousName, inviteSelections, resolveAnonymousNameError, selected, roundId, t, uid])

  const onRemoveRoundParticipant = useCallback(
    async (participantId: string) => {
      if (!roundId || !canManageRoundRoster) return
      setBusy(true)
      setError(null)
      setNotice(null)
      try {
        await removeParticipantFromRound({
          roundId: roundId,
          actorUid: uid,
          participantId,
        })
        setNotice(t('scoring.messages.participantRemoved'))
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? translateUserError(t, nextError.message)
            : t('scoring.errors.failedToRemoveParticipant'),
        )
      } finally {
        setBusy(false)
      }
    },
    [canManageRoundRoster, roundId, t, uid],
  )

  const onReplaceRoundParticipant = useCallback(async () => {
    if (!roundId || !rosterReplaceFromId || !rosterReplaceTargetUid || !canManageRoundRoster) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await replaceRoundParticipant({
        roundId: roundId,
        actorUid: uid,
        fromParticipantId: rosterReplaceFromId,
        toParticipantUid: rosterReplaceTargetUid,
      })
      clearRosterReplaceFlow()
      setNotice(t('scoring.messages.participantReplaced'))
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? translateUserError(t, nextError.message)
          : t('scoring.errors.failedToReplaceParticipant'),
      )
    } finally {
      setBusy(false)
    }
  }, [
    canManageRoundRoster,
    clearRosterReplaceFlow,
    rosterReplaceFromId,
    rosterReplaceTargetUid,
    roundId,
    t,
    uid,
  ])

  const onDeleteRound = useCallback(
    async (deletedRoundId: string, ownerId: string) => {
      if (ownerId !== uid && !isAdmin) return
      const confirmed = window.confirm(t('scoring.confirmations.deleteRound'))
      if (!confirmed) return
      setBusy(true)
      setError(null)
      setNotice(null)
      try {
        await deleteRound(deletedRoundId)
        if (deletedRoundId === roundId) {
          clearRosterReplaceFlow()
          setHoleNumber(1)
          resetHoleDraft()
          onAfterRoundDeleted?.()
        }
        setNotice(t('scoring.notices.roundDeleted'))
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? translateUserError(t, nextError.message)
            : t('scoring.errors.failedToDeleteRound'),
        )
      } finally {
        setBusy(false)
      }
    },
    [clearRosterReplaceFlow, isAdmin, onAfterRoundDeleted, resetHoleDraft, roundId, t, uid],
  )

  const onComplete = useCallback(async () => {
    if (!roundId || !selected) return
    if (selected.data.courseSource === 'fresh') {
      try {
        normalizeFreshCourseDraftForPromotion(selected.data.courseDraft)
      } catch (nextError) {
        if (nextError instanceof FreshRoundDraftValidationError) {
          setError(
            t('scoring.errors.roundCannotCompleteWithDetails', {
              details: formatDraftIssues(t, nextError.issues),
            }),
          )
          return
        }
        throw nextError
      }
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const result = await completeRoundAndPromote(roundId, uid)
      if (result.promotionStatus === 'created' || result.promotionStatus === 'already_created') {
        setNotice(t('scoring.notices.roundCompletedPromoted'))
      } else if (result.promotionStatus === 'pending') {
        setNotice(t('scoring.notices.roundCompletedPromotionPending'))
      } else if (result.promotionStatus === 'failed') {
        setError(
          t('scoring.errors.roundCannotCompleteWithDetails', {
            details: formatDraftIssues(t, result.validationIssues ?? []),
          }),
        )
      } else {
        setActiveTab('results')
      }
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? translateUserError(t, nextError.message)
          : t('scoring.errors.failedToCompleteRound'),
      )
    } finally {
      setBusy(false)
    }
  }, [selected, roundId, t, uid])

  const onRetryPromotion = useCallback(async () => {
    if (!roundId) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const result = await completeRoundAndPromote(roundId, uid)
      if (result.promotionStatus === 'created' || result.promotionStatus === 'already_created') {
        setNotice(t('scoring.notices.promotionSucceeded'))
      } else if (result.promotionStatus === 'pending') {
        setNotice(t('scoring.notices.promotionStillPending'))
      } else if (result.promotionStatus === 'failed') {
        setError(
          t('scoring.errors.promotionBlockedWithDetails', {
            details: formatDraftIssues(t, result.validationIssues ?? []),
          }),
        )
      }
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? translateUserError(t, nextError.message)
          : t('scoring.errors.failedToRetryPromotion'),
      )
    } finally {
      setBusy(false)
    }
  }, [roundId, t, uid])

  const isRoundCompleted = selected?.data.completedAt !== null && selected?.data.completedAt !== undefined

  const selectedResultUnits = useMemo(() => {
    if (!selected) {
      return []
    }
    return buildRoundResultUnits({
      participantIds: selected.data.participantIds,
      participantNames: selectedParticipantNames,
      teams: isScrambleScoring ? selectedScrambleTeams : undefined,
    })
  }, [isScrambleScoring, selected, selectedParticipantNames, selectedScrambleTeams])

  const canCompleteRound = selected ? selected.data.ownerId === uid || isAdmin : false
  const holeSubmitMode = selectedHoleCount
    ? resolveHoleSubmitMode({ activeHoleNumber, holeCount: selectedHoleCount })
    : null
  const holeSubmitLabel = holeSubmitMode === 'complete'
    ? canCompleteRound
      ? t('scoring.buttons.completeRound')
      : t('scoring.buttons.saveLastHole')
    : t('scoring.stepper.nextHoleCta')

  const submitHoleFormAction = useCallback(async () => {
    if (!selectedHoleCount || busy || isSaving || !effectiveHoleDraft || !holeSubmitMode) return

    if (holeSubmitMode === 'complete') {
      const saved = await leaveHole(activeHoleNumber)
      if (saved && canCompleteRound) {
        await onComplete()
      }
      return
    }

    await leaveHole(stepHoleNumber(activeHoleNumber, 1, selectedHoleCount))
  }, [
    activeHoleNumber,
    busy,
    canCompleteRound,
    effectiveHoleDraft,
    holeSubmitMode,
    isSaving,
    leaveHole,
    onComplete,
    selectedHoleCount,
  ])

  const onCompleteWithSave = useCallback(async () => {
    const saved = await leaveHole(activeHoleNumber)
    if (saved) {
      await onComplete()
    }
  }, [activeHoleNumber, leaveHole, onComplete])

  const onSubmitHoleForm = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      void submitHoleFormAction()
    },
    [submitHoleFormAction],
  )

  return (
    <section className="scoring-panel" aria-labelledby="scoring-panel-title">
      <h2 id="scoring-panel-title" className="scoring-panel__title">
        {t('scoring.title')}
      </h2>
      {error ? (
        <p className="scoring-panel__error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? <p className="scoring-panel__notice">{notice}</p> : null}

      <div className="scoring-panel__tabs" role="tablist" aria-label={t('scoring.aria.workspaceTabs')}>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'scorecard'}
          className={`scoring-panel__tab${activeTab === 'scorecard' ? ' scoring-panel__tab--active' : ''}`}
          onClick={() => setActiveTab('scorecard')}
        >
          {t('scoring.tabs.scorecard')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'results'}
          className={`scoring-panel__tab${activeTab === 'results' ? ' scoring-panel__tab--active' : ''}`}
          onClick={() => setActiveTab('results')}
        >
          {t('scoring.tabs.results')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'participants'}
          className={`scoring-panel__tab${activeTab === 'participants' ? ' scoring-panel__tab--active' : ''}`}
          onClick={() => setActiveTab('participants')}
        >
          {t('scoring.tabs.participants')}
        </button>
      </div>

      {activeTab === 'scorecard' ? (
        <ScoringPanelScorecardTab
          roundId={roundId}
          canDeleteRound={Boolean(selected && (selected.data.ownerId === uid || isAdmin))}
          roundMissingAfterSync={roundMissingAfterSync}
          selected={selected}
          selectedSummary={selectedSummary}
          fullyScoredHoles={fullyScoredHoles}
          selectedHoleCount={selectedHoleCount}
          activeHoleNumber={activeHoleNumber}
          leaveHole={leaveHole}
          stepHoleNumber={stepHoleNumber}
          controlsDisabled={busy || isSaving}
          saveInProgress={isSaving}
          effectiveHoleDraft={effectiveHoleDraft}
          honorHint={honorHint}
          updateHoleDraft={updateHoleDraft}
          savedCourseMetadataLocked={savedCourseMetadataLocked}
          holeFormSaveStatusLabel={holeFormSaveStatusLabel}
          saveFailed={saveState === 'error'}
          onRetrySave={() => void flushAndSaveHole()}
          onSubmitHoleForm={onSubmitHoleForm}
          scrambleTeams={isScrambleScoring ? selectedScrambleTeams : undefined}
          selectedParticipantNames={selectedParticipantNames}
          selectedParticipantTotals={selectedParticipantTotals}
          holeSubmitMode={holeSubmitMode}
          holeSubmitLabel={holeSubmitLabel}
          canCompleteRound={canCompleteRound}
          onCompleteWithSave={onCompleteWithSave}
          onRetryPromotion={onRetryPromotion}
          onDeleteRound={onDeleteRound}
        />
      ) : null}

      {activeTab === 'results' ? (
        <ScoringPanelResultsTab
          selected={selected}
          isRoundCompleted={isRoundCompleted}
          selectedResultUnits={selectedResultUnits}
          selectedParticipantTotals={selectedParticipantTotals}
          selectedParticipantNames={selectedParticipantNames}
          selectedParticipantScores={selectedParticipantScores}
          selectedHoleCount={selectedHoleCount}
          selectedHoleMetadataByNumber={selectedHoleMetadataByNumber}
          isScrambleScoring={isScrambleScoring}
          selectedScrambleTeams={selectedScrambleTeams}
        />
      ) : null}

      {activeTab === 'participants' ? (
        !selected ? (
          <div className="scoring-panel__section">
            <span className="scoring-panel__label">{t('scoring.sections.roundParticipants')}</span>
            <p className="scoring-panel__muted">{t('scoring.participants.selectRoundFirst')}</p>
          </div>
        ) : (
          <ScoringPanelParticipantsTab
            selected={selected}
            selectedParticipantTotals={selectedParticipantTotals}
            selectedParticipantNames={selectedParticipantNames}
            selectedGrandTotals={selectedGrandTotals}
            canManageRoundRoster={canManageRoundRoster}
            busy={busy}
            rosterReplaceFromId={rosterReplaceFromId}
            setRosterReplaceFromId={setRosterReplaceFromId}
            rosterReplaceQuery={rosterReplaceQuery}
            setRosterReplaceQuery={setRosterReplaceQuery}
            rosterReplaceTargetUid={rosterReplaceTargetUid}
            setRosterReplaceTargetUid={setRosterReplaceTargetUid}
            rosterReplaceCandidateEntries={rosterReplaceCandidateEntries}
            onRemoveRoundParticipant={onRemoveRoundParticipant}
            onReplaceRoundParticipant={onReplaceRoundParticipant}
            inviteParticipantQuery={inviteParticipantQuery}
            setInviteParticipantQuery={setInviteParticipantQuery}
            inviteSelections={inviteSelections}
            setInviteSelections={setInviteSelections}
            inviteCandidateEntries={inviteCandidateEntries}
            inviteAnonymousName={inviteAnonymousName}
            setInviteAnonymousName={setInviteAnonymousName}
            inviteAnonymousNameError={inviteAnonymousNameError}
            setInviteAnonymousNameError={setInviteAnonymousNameError}
            inviteAnonymousNameInputRef={inviteAnonymousNameInputRef}
            resolveAnonymousNameError={resolveAnonymousNameError}
            onAddParticipant={onAddParticipant}
          />
        )
      ) : null}
    </section>
  )
}
