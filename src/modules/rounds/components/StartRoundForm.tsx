import type { User } from 'firebase/auth'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import {
  loadRoundSelectionForCourse,
  subscribeCourses,
  type CourseWithId,
} from '@core/domain/courseData'
import { filterCoursesByNameQuery, sortCoursesForRoundStart } from '@core/domain/roundStartSort'
import {
  FreshRoundDraftValidationError,
  normalizeFreshCourseDraft,
} from '@core/domain/freshRoundCourse'
import {
  normalizeProfileScrambleTeamPresets,
  roundTeamsFromWizard,
  type ProfileScrambleTeamPreset,
} from '@core/domain/profileScrambleTeams'
import type { RoundTeam } from '@core/domain/roundTeams'
import { createRound } from '@core/domain/rounds'
import { subscribeFollowers, subscribeFollowing } from '@core/users/follows'
import { subscribeScrambleTeamPresets } from '@core/users/userProfile'
import { subscribeUserDirectory, type UserDirectoryEntry } from '@core/users/userDirectory'
import { translateUserError } from '@common/i18n/translateError'
import { formatDraftIssues } from '@common/helpers/formatDraftIssues'
import {
  createAnonymousParticipantId,
  deriveFriendUidSet,
  filterParticipantDirectoryEntries,
  isAnonymousParticipantId,
  mergeAnonymousParticipants,
  normalizeAnonymousParticipantName,
  type AnonymousParticipant,
} from '@core/domain/participantRoster'
import { StartRoundCourseStep } from '@modules/rounds/components/StartRoundCourseStep'
import {
  StartRoundPlayersStep,
  type RosterEntry,
} from '@modules/rounds/components/StartRoundPlayersStep'
import { StartRoundReviewStep } from '@modules/rounds/components/StartRoundReviewStep'
import {
  addWizardTeam,
  applyAllSavedTeamsToWizard,
  applyOneSavedTeamToWizard,
  buildReviewTeamSummaries,
  buildSavedTeamPresetSummaries,
  removeWizardParticipantFromTeams,
  removeWizardTeam,
  resolveInitialCourseMode,
  resolveInitialSavedCourseId,
  syncWizardTeamsWithRoster,
  toggleWizardTeamMember,
  updateWizardTeamName,
  validateCourseStep,
  type CourseMode,
  type WizardStep,
} from '@modules/rounds/domain/startRoundWizard'

type Props = {
  user: User
  favoriteCourseIds: string[]
  onRoundCreated: (roundId: string) => void
}

type NineOrEighteen = 9 | 18

const ANONYMOUS_NAME_MAX_LENGTH = 80
const WIZARD_STEPS: WizardStep[] = ['course', 'players', 'review']

function participantDisplayName(entry: UserDirectoryEntry): string {
  return entry.displayName.trim().length > 0 ? entry.displayName : entry.uid
}

export function StartRoundForm({ user, favoriteCourseIds, onRoundCreated }: Props) {
  const { t } = useTranslation('common')
  const location = useLocation()
  const presetCourseId =
    typeof location.state === 'object' &&
    location.state !== null &&
    'courseId' in location.state &&
    typeof (location.state as { courseId?: unknown }).courseId === 'string'
      ? (location.state as { courseId: string }).courseId
      : null

  const uid = user.uid
  const [wizardStep, setWizardStep] = useState<WizardStep>('course')
  const [courseMode, setCourseMode] = useState<CourseMode>('quick')
  const [selectedSavedCourseId, setSelectedSavedCourseId] = useState<string | null>(null)
  const [courseSearchQuery, setCourseSearchQuery] = useState('')
  const [availableCourses, setAvailableCourses] = useState<CourseWithId[]>([])
  const [courseLoadError, setCourseLoadError] = useState<string | null>(null)
  const [freshCourseName, setFreshCourseName] = useState('')
  const [freshHoleChoice, setFreshHoleChoice] = useState<NineOrEighteen>(18)
  const [newRoundParticipants, setNewRoundParticipants] = useState<string[]>([uid])
  const [newRoundParticipantQuery, setNewRoundParticipantQuery] = useState('')
  const [newRoundAnonymousName, setNewRoundAnonymousName] = useState('')
  const [freshCourseNameError, setFreshCourseNameError] = useState<string | null>(null)
  const [newRoundAnonymousNameError, setNewRoundAnonymousNameError] = useState<string | null>(null)
  const [newRoundAnonymousParticipants, setNewRoundAnonymousParticipants] = useState<AnonymousParticipant[]>([])
  const [profileTeamPresets, setProfileTeamPresets] = useState<ProfileScrambleTeamPreset[]>([])
  const [wizardTeams, setWizardTeams] = useState<RoundTeam[]>([])
  const [directoryEntries, setDirectoryEntries] = useState<UserDirectoryEntry[]>([])
  const [followingIds, setFollowingIds] = useState<string[]>([])
  const [followerIds, setFollowerIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const freshCourseNameInputRef = useRef<HTMLInputElement | null>(null)
  const newRoundAnonymousNameInputRef = useRef<HTMLInputElement | null>(null)

  const presetAppliedRef = useRef<string | null>(null)
  const defaultsAppliedRef = useRef(false)

  useEffect(() => {
    const unsub = subscribeCourses(
      (rows) => {
        setAvailableCourses(rows)
        setCourseLoadError(null)
        if (
          presetCourseId &&
          presetAppliedRef.current !== presetCourseId &&
          rows.some((c) => c.id === presetCourseId)
        ) {
          presetAppliedRef.current = presetCourseId
          setCourseMode('saved')
          setSelectedSavedCourseId(presetCourseId)
          defaultsAppliedRef.current = true
          return
        }
        if (!defaultsAppliedRef.current && rows.length >= 0) {
          const sortedIds = sortCoursesForRoundStart(rows, favoriteCourseIds).map((course) => course.id)
          const initialMode = resolveInitialCourseMode({
            availableCourseIds: sortedIds,
            favoriteCourseIds,
          })
          const initialSavedId = resolveInitialSavedCourseId({
            sortedCourseIds: sortedIds,
            favoriteCourseIds,
          })
          setCourseMode(initialMode)
          setSelectedSavedCourseId(initialSavedId)
          defaultsAppliedRef.current = true
        }
      },
      (nextError) => setCourseLoadError(translateUserError(t, nextError.message)),
    )
    return () => unsub()
  }, [favoriteCourseIds, presetCourseId, t])

  useEffect(() => {
    const unsub = subscribeUserDirectory(
      (entries) => setDirectoryEntries(entries),
      () => {
        /* directory may be restricted */
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
      () => {},
    )
    return () => unsub()
  }, [uid])

  useEffect(() => {
    const unsub = subscribeFollowers(
      uid,
      (edges) => {
        setFollowerIds(Array.from(new Set(edges.map((edge) => edge.followerUid))))
      },
      () => {},
    )
    return () => unsub()
  }, [uid])

  useEffect(() => {
    const unsub = subscribeScrambleTeamPresets(
      uid,
      (presets) => setProfileTeamPresets(normalizeProfileScrambleTeamPresets(presets)),
      () => {},
    )
    return () => unsub()
  }, [uid])

  const resolveFreshCourseNameError = useCallback(
    (input: HTMLInputElement): string => {
      if (input.validity.valueMissing || input.validity.patternMismatch) {
        return t('scoring.errors.courseNameRequired')
      }
      return input.validationMessage || t('scoring.errors.courseNameRequired')
    },
    [t],
  )

  const resolveAnonymousNameError = useCallback(
    (input: HTMLInputElement): string => {
      if (input.validity.valueMissing || input.validity.patternMismatch) {
        return t('scoring.messages.anonymousNameRequired')
      }
      if (input.validity.tooLong) {
        return t('scoring.messages.anonymousNameTooLong', {
          max: ANONYMOUS_NAME_MAX_LENGTH,
        })
      }
      return input.validationMessage || t('scoring.messages.anonymousNameRequired')
    },
    [t],
  )

  const sortedRoundStartCourses = useMemo(
    () => sortCoursesForRoundStart(availableCourses, favoriteCourseIds),
    [availableCourses, favoriteCourseIds],
  )
  const filteredRoundStartCourses = useMemo(
    () => filterCoursesByNameQuery(sortedRoundStartCourses, courseSearchQuery),
    [courseSearchQuery, sortedRoundStartCourses],
  )
  const favoriteCourseIdSet = useMemo(() => new Set(favoriteCourseIds), [favoriteCourseIds])
  const selectedSavedCourse = useMemo(
    () => sortedRoundStartCourses.find((course) => course.id === selectedSavedCourseId) ?? null,
    [selectedSavedCourseId, sortedRoundStartCourses],
  )
  const noSavedCourses = sortedRoundStartCourses.length === 0

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

  const ownerDisplayName = participantDisplayName(directoryByUid[uid])

  const allDirectoryEntries = useMemo(
    () =>
      Object.values(directoryByUid).sort((a, b) =>
        participantDisplayName(a).localeCompare(participantDisplayName(b), undefined, {
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

  const availableNewRoundParticipants = useMemo(
    () =>
      filterParticipantDirectoryEntries({
        entries: searchableDirectoryEntries,
        query: newRoundParticipantQuery,
        friendUidSet,
      }),
    [friendUidSet, newRoundParticipantQuery, searchableDirectoryEntries],
  )

  const rosterEntries = useMemo((): RosterEntry[] => {
    const entries: RosterEntry[] = [{ id: uid, name: ownerDisplayName, kind: 'you' }]
    const anonymousById = new Map(newRoundAnonymousParticipants.map((participant) => [participant.id, participant]))

    for (const participantId of newRoundParticipants) {
      if (participantId === uid) continue
      if (isAnonymousParticipantId(participantId)) {
        const anonymous = anonymousById.get(participantId)
        if (anonymous) {
          entries.push({ id: participantId, name: anonymous.displayName, kind: 'guest' })
        }
        continue
      }
      const entry = directoryByUid[participantId]
      entries.push({
        id: participantId,
        name: entry ? participantDisplayName(entry) : participantId,
        kind: 'registered',
      })
    }
    return entries
  }, [directoryByUid, newRoundAnonymousParticipants, newRoundParticipants, ownerDisplayName, uid])

  const reviewPlayerNames = useMemo(() => rosterEntries.map((entry) => entry.name), [rosterEntries])

  const participantIds = useMemo(
    () =>
      Array.from(new Set([uid, ...newRoundParticipants])).filter(
        (participantId) => participantId.trim().length > 0,
      ),
    [newRoundParticipants, uid],
  )

  const rosterNameById = useMemo(
    () => new Map(rosterEntries.map((entry) => [entry.id, entry.name])),
    [rosterEntries],
  )

  const teamMemberOptions = useMemo(
    () => rosterEntries.map((entry) => ({ id: entry.id, name: entry.name })),
    [rosterEntries],
  )

  const savedTeamPresets = useMemo(
    () => buildSavedTeamPresetSummaries(profileTeamPresets, participantIds, rosterNameById),
    [participantIds, profileTeamPresets, rosterNameById],
  )

  const syncedWizardTeams = useMemo(
    () => syncWizardTeamsWithRoster(participantIds, wizardTeams),
    [participantIds, wizardTeams],
  )

  const reviewTeamSummaries = useMemo(
    () => buildReviewTeamSummaries(syncedWizardTeams, rosterNameById),
    [rosterNameById, syncedWizardTeams],
  )

  const onAddNewRoundAnonymousParticipant = useCallback(() => {
    const anonymousInput = newRoundAnonymousNameInputRef.current
    if (!anonymousInput) {
      return
    }
    anonymousInput.setCustomValidity('')
    if (newRoundAnonymousName.trim().length === 0) {
      anonymousInput.setCustomValidity(t('scoring.messages.anonymousNameRequired'))
    }
    if (!anonymousInput.checkValidity()) {
      setNewRoundAnonymousNameError(resolveAnonymousNameError(anonymousInput))
      return
    }

    const normalizedName = normalizeAnonymousParticipantName(newRoundAnonymousName)
    const id = createAnonymousParticipantId()
    setNewRoundAnonymousParticipants((current) => [...current, { id, displayName: normalizedName }])
    setNewRoundParticipants((current) => Array.from(new Set([...current, id])))
    setNewRoundAnonymousName('')
    setNewRoundAnonymousNameError(null)
    anonymousInput.setCustomValidity('')
    setError(null)
  }, [newRoundAnonymousName, resolveAnonymousNameError, t])

  const onRemoveRosterEntry = useCallback((entry: RosterEntry) => {
    if (entry.kind === 'guest') {
      setNewRoundAnonymousParticipants((current) =>
        current.filter((participant) => participant.id !== entry.id),
      )
    }
    setNewRoundParticipants((current) => current.filter((participantId) => participantId !== entry.id))
    setWizardTeams((current) => removeWizardParticipantFromTeams(current, entry.id))
  }, [])

  const onToggleParticipant = useCallback((participantId: string) => {
    setNewRoundParticipants((current) => {
      if (current.includes(participantId)) {
        setWizardTeams((teams) => removeWizardParticipantFromTeams(teams, participantId))
        return current.filter((id) => id !== participantId)
      }
      return [...current, participantId]
    })
  }, [])

  const onApplyAllSavedTeams = useCallback(() => {
    setWizardTeams(applyAllSavedTeamsToWizard(participantIds, profileTeamPresets))
  }, [participantIds, profileTeamPresets])

  const onApplySavedTeam = useCallback(
    (presetId: string) => {
      const preset = profileTeamPresets.find((entry) => entry.id === presetId)
      if (!preset) {
        return
      }
      setWizardTeams((current) => applyOneSavedTeamToWizard(participantIds, current, preset))
    },
    [participantIds, profileTeamPresets],
  )

  const onAddWizardTeam = useCallback(() => {
    setWizardTeams((current) =>
      syncWizardTeamsWithRoster(
        participantIds,
        addWizardTeam(current, t('profile.teams.defaultName', { number: current.length + 1 })),
      ),
    )
  }, [participantIds, t])

  const onRemoveWizardTeam = useCallback(
    (teamId: string) => {
      setWizardTeams((current) => syncWizardTeamsWithRoster(participantIds, removeWizardTeam(current, teamId)))
    },
    [participantIds],
  )

  const onWizardTeamNameChange = useCallback(
    (teamId: string, name: string) => {
      setWizardTeams((current) =>
        syncWizardTeamsWithRoster(participantIds, updateWizardTeamName(current, teamId, name)),
      )
    },
    [participantIds],
  )

  const onToggleWizardTeamMember = useCallback(
    (teamId: string, memberParticipantId: string) => {
      setWizardTeams((current) =>
        syncWizardTeamsWithRoster(
          participantIds,
          toggleWizardTeamMember(current, teamId, memberParticipantId),
        ),
      )
    },
    [participantIds],
  )

  const onCourseModeChange = useCallback(
    (mode: CourseMode) => {
      setCourseMode(mode)
      setFreshCourseNameError(null)
      setError(null)
      if (mode === 'saved' && !selectedSavedCourseId && sortedRoundStartCourses[0]) {
        setSelectedSavedCourseId(sortedRoundStartCourses[0].id)
      }
    },
    [selectedSavedCourseId, sortedRoundStartCourses],
  )

  const onAdvanceFromCourseStep = useCallback(async () => {
    setError(null)
    if (courseMode === 'quick') {
      const freshNameInput = freshCourseNameInputRef.current
      if (freshNameInput && !freshNameInput.checkValidity()) {
        setFreshCourseNameError(resolveFreshCourseNameError(freshNameInput))
        return
      }
    }

    if (
      !validateCourseStep({
        courseMode,
        selectedSavedCourseId,
        freshCourseName,
      })
    ) {
      if (courseMode === 'quick') {
        setFreshCourseNameError(t('scoring.errors.courseNameRequired'))
      } else {
        setError(t('scoring.errors.selectCourseOrFresh'))
      }
      return
    }

    if (courseMode === 'saved') {
      if (!selectedSavedCourse) {
        setError(t('scoring.errors.selectCourseOrFresh'))
        return
      }
      setBusy(true)
      try {
        const selection = await loadRoundSelectionForCourse({
          courseId: selectedSavedCourse.id,
          courseName: selectedSavedCourse.name,
        })
        if (!selection) {
          setError(t('scoring.errors.selectedCourseHasNoTemplates'))
          return
        }
        setWizardStep('players')
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? translateUserError(t, nextError.message)
            : t('scoring.errors.failedToCreateRound'),
        )
      } finally {
        setBusy(false)
      }
      return
    }

    setWizardStep('players')
  }, [
    courseMode,
    freshCourseName,
    resolveFreshCourseNameError,
    selectedSavedCourse,
    selectedSavedCourseId,
    t,
  ])

  const onCreateRound = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const anonymousParticipants = mergeAnonymousParticipants(participantIds, newRoundAnonymousParticipants)
      const teams = roundTeamsFromWizard(participantIds, syncedWizardTeams)
      const roundInput = {
        ownerId: uid,
        visibility: 'public' as const,
        participantIds,
        anonymousParticipants,
        ...(teams.length > 0 ? { teams, scoringMode: 'scramble' as const } : {}),
      }
      let id = ''
      if (courseMode === 'saved') {
        if (!selectedSavedCourse) {
          setError(t('scoring.errors.selectCourseOrFresh'))
          return
        }
        const selection = await loadRoundSelectionForCourse({
          courseId: selectedSavedCourse.id,
          courseName: selectedSavedCourse.name,
        })
        if (!selection) {
          setError(t('scoring.errors.selectedCourseHasNoTemplates'))
          return
        }
        id = await createRound({
          ...roundInput,
          courseSource: 'saved',
          courseId: selection.courseId,
          templateId: selection.templateId,
          holeCount: selection.holeCount,
          courseName: selectedSavedCourse.name,
        })
      } else {
        const courseDraft = normalizeFreshCourseDraft({
          name: freshCourseName,
          holes: Array.from({ length: freshHoleChoice }, () => ({
            par: null,
            lengthMeters: null,
          })),
        })
        id = await createRound({
          ...roundInput,
          courseSource: 'fresh',
          courseDraft,
          holeCount: courseDraft.holes.length,
        })
      }
      setFreshCourseNameError(null)
      setNewRoundParticipantQuery('')
      setNewRoundAnonymousName('')
      setNewRoundAnonymousNameError(null)
      setNewRoundAnonymousParticipants([])
      setNewRoundParticipants([uid])
      setWizardTeams([])
      setFreshHoleChoice(18)
      setCourseMode('quick')
      setSelectedSavedCourseId(null)
      setCourseSearchQuery('')
      setWizardStep('course')
      setFreshCourseName('')
      defaultsAppliedRef.current = false
      onRoundCreated(id)
    } catch (nextError) {
      if (nextError instanceof FreshRoundDraftValidationError) {
        setError(formatDraftIssues(t, nextError.issues))
      } else {
        setError(
          nextError instanceof Error
            ? translateUserError(t, nextError.message)
            : t('scoring.errors.failedToCreateRound'),
        )
      }
    } finally {
      setBusy(false)
    }
  }, [
    courseMode,
    freshCourseName,
    freshHoleChoice,
    newRoundAnonymousParticipants,
    onRoundCreated,
    participantIds,
    selectedSavedCourse,
    syncedWizardTeams,
    t,
    uid,
  ])

  const currentStepIndex = WIZARD_STEPS.indexOf(wizardStep)

  return (
    <section className="start-round-form start-round-wizard" aria-labelledby="start-round-form-title">
      <h2 id="start-round-form-title" className="scoring-panel__title">
        {t('rounds.new.title')}
      </h2>

      <ol className="start-round-wizard__steps" aria-label={t('rounds.new.title')}>
        {WIZARD_STEPS.map((step, index) => {
          const isActive = step === wizardStep
          const isDone = index < currentStepIndex
          return (
            <li
              key={step}
              className={`start-round-wizard__step${isActive ? ' start-round-wizard__step--active' : ''}${
                isDone ? ' start-round-wizard__step--done' : ''
              }`}
              aria-current={isActive ? 'step' : undefined}
            >
              <span className="start-round-wizard__step-index">{index + 1}</span>
              <span>{t(`rounds.new.wizard.steps.${step}`)}</span>
            </li>
          )
        })}
      </ol>

      {error ? (
        <p className="scoring-panel__error" role="alert">
          {error}
        </p>
      ) : null}

      {wizardStep === 'course' ? (
        <StartRoundCourseStep
          courseMode={courseMode}
          onCourseModeChange={onCourseModeChange}
          courseSearchQuery={courseSearchQuery}
          onCourseSearchQueryChange={setCourseSearchQuery}
          filteredCourses={filteredRoundStartCourses}
          favoriteCourseIdSet={favoriteCourseIdSet}
          selectedSavedCourseId={selectedSavedCourseId}
          onSelectedSavedCourseIdChange={setSelectedSavedCourseId}
          freshCourseName={freshCourseName}
          onFreshCourseNameChange={(value) => {
            setFreshCourseName(value)
            if (freshCourseNameError && value.trim().length > 0) {
              setFreshCourseNameError(null)
            }
          }}
          freshCourseNameError={freshCourseNameError}
          freshCourseNameInputRef={freshCourseNameInputRef}
          onFreshCourseNameInvalid={(input) => setFreshCourseNameError(resolveFreshCourseNameError(input))}
          freshHoleChoice={freshHoleChoice}
          onFreshHoleChoiceChange={setFreshHoleChoice}
          busy={busy}
          courseLoadError={courseLoadError}
          noSavedCourses={noSavedCourses}
        />
      ) : null}

      {wizardStep === 'players' ? (
        <StartRoundPlayersStep
          rosterEntries={rosterEntries}
          onRemoveRosterEntry={onRemoveRosterEntry}
          availableParticipants={availableNewRoundParticipants}
          selectedParticipantIds={newRoundParticipants}
          onToggleParticipant={onToggleParticipant}
          participantQuery={newRoundParticipantQuery}
          onParticipantQueryChange={setNewRoundParticipantQuery}
          anonymousName={newRoundAnonymousName}
          onAnonymousNameChange={(value) => {
            setNewRoundAnonymousName(value)
            if (newRoundAnonymousNameError && value.trim().length > 0) {
              setNewRoundAnonymousNameError(null)
            }
          }}
          anonymousNameError={newRoundAnonymousNameError}
          anonymousNameInputRef={newRoundAnonymousNameInputRef}
          onAnonymousNameInvalid={(input) => setNewRoundAnonymousNameError(resolveAnonymousNameError(input))}
          onAddAnonymousParticipant={onAddNewRoundAnonymousParticipant}
          participantDisplayName={participantDisplayName}
          savedTeamPresets={savedTeamPresets}
          onApplyAllSavedTeams={onApplyAllSavedTeams}
          onApplySavedTeam={onApplySavedTeam}
          teamMemberOptions={teamMemberOptions}
          wizardTeams={syncedWizardTeams}
          onAddTeam={onAddWizardTeam}
          onRemoveTeam={onRemoveWizardTeam}
          onTeamNameChange={onWizardTeamNameChange}
          onToggleTeamMember={onToggleWizardTeamMember}
          busy={busy}
        />
      ) : null}

      {wizardStep === 'review' ? (
        <StartRoundReviewStep
          courseMode={courseMode}
          savedCourseName={selectedSavedCourse?.name ?? null}
          quickCourseName={freshCourseName}
          holeCount={freshHoleChoice}
          playerNames={reviewPlayerNames}
          teamSummaries={reviewTeamSummaries}
        />
      ) : null}

      <div className="start-round-wizard__nav">
        {wizardStep !== 'course' ? (
          <button
            type="button"
            className="scoring-panel__button"
            onClick={() => {
              setError(null)
              setWizardStep(wizardStep === 'review' ? 'players' : 'course')
            }}
            disabled={busy}
          >
            {t('rounds.new.wizard.nav.back')}
          </button>
        ) : (
          <span />
        )}
        <div className="start-round-wizard__nav-actions">
          {wizardStep === 'course' ? (
            <button
              type="button"
              className="scoring-panel__button scoring-panel__button--primary"
              onClick={() => void onAdvanceFromCourseStep()}
              disabled={busy || (courseMode === 'saved' && noSavedCourses)}
            >
              {t('rounds.new.wizard.nav.next')}
            </button>
          ) : null}
          {wizardStep === 'players' ? (
            <button
              type="button"
              className="scoring-panel__button scoring-panel__button--primary"
              onClick={() => {
                setError(null)
                setWizardStep('review')
              }}
              disabled={busy}
            >
              {t('rounds.new.wizard.nav.next')}
            </button>
          ) : null}
          {wizardStep === 'review' ? (
            <button
              type="button"
              className="dashboard-home__cta scoring-panel__button scoring-panel__button--primary"
              onClick={() => void onCreateRound()}
              disabled={busy}
            >
              {t('rounds.new.continueToScorecard')}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  )
}
