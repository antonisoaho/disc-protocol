import type { User } from 'firebase/auth'
import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@core/auth/useAuth'
import {
  createProfileTeamPresetId,
  filterVisibleAggregatedTeamPresets,
  isAggregatedTeamPresetEditable,
  mergeProfileTeamPresetSave,
  type AggregatedScrambleTeamPreset,
  type ProfileScrambleTeamPreset,
} from '@core/domain/profileScrambleTeams'
import { removeTeam, toggleTeamMember, type RoundTeam } from '@core/domain/roundTeams'
import {
  saveScrambleTeamPresets,
  subscribeAggregatedScrambleTeamPresets,
} from '@core/users/userProfile'
import { subscribeUserDirectory, type UserDirectoryEntry } from '@core/users/userDirectory'
import { translateUserError } from '@common/i18n/translateError'

type EditableTeam = RoundTeam & { ownerUid: string }

type ModelState = {
  aggregatedEntries: AggregatedScrambleTeamPreset[]
  directoryEntries: UserDirectoryEntry[]
  localTeamsDraft: { seed: string; teams: EditableTeam[] } | null
  busy: boolean
  error: string | null
  notice: string | null
}

type ModelAction =
  | { type: 'setAggregatedEntries'; entries: AggregatedScrambleTeamPreset[] }
  | { type: 'setDirectoryEntries'; entries: UserDirectoryEntry[] }
  | { type: 'setError'; error: string | null }
  | { type: 'setNotice'; notice: string | null }
  | { type: 'setBusy'; busy: boolean }
  | { type: 'setLocalTeamsDraft'; draft: { seed: string; teams: EditableTeam[] } | null }
  | { type: 'persistStart' }
  | { type: 'persistSuccess'; notice: string }
  | { type: 'persistError'; error: string }

function modelReducer(state: ModelState, action: ModelAction): ModelState {
  switch (action.type) {
    case 'setAggregatedEntries':
      return { ...state, aggregatedEntries: action.entries, error: null }
    case 'setDirectoryEntries':
      return { ...state, directoryEntries: action.entries }
    case 'setError':
      return { ...state, error: action.error }
    case 'setNotice':
      return { ...state, notice: action.notice }
    case 'setBusy':
      return { ...state, busy: action.busy }
    case 'setLocalTeamsDraft':
      return { ...state, localTeamsDraft: action.draft }
    case 'persistStart':
      return { ...state, busy: true, error: null, notice: null }
    case 'persistSuccess':
      return { ...state, busy: false, notice: action.notice }
    case 'persistError':
      return { ...state, busy: false, error: action.error }
    default:
      return state
  }
}

const initialModelState: ModelState = {
  aggregatedEntries: [],
  directoryEntries: [],
  localTeamsDraft: null,
  busy: false,
  error: null,
  notice: null,
}

function memberDisplayName(entry: UserDirectoryEntry): string {
  return entry.displayName.trim().length > 0 ? entry.displayName : entry.uid
}

function aggregatedToEditableTeams(entries: AggregatedScrambleTeamPreset[]): EditableTeam[] {
  return entries.map((entry) => ({
    id: entry.preset.id,
    name: entry.preset.name,
    participantIds: [...entry.preset.memberUids],
    ownerUid: entry.ownerUid,
  }))
}

function editableTeamsToPresets(teams: EditableTeam[]): ProfileScrambleTeamPreset[] {
  return teams.map((team) => ({
    id: team.id,
    name: team.name.trim(),
    memberUids: [...team.participantIds],
  }))
}

function editablePresetIdsForOwner(
  editableEntries: AggregatedScrambleTeamPreset[],
  ownerUid: string,
): Set<string> {
  const ids = new Set<string>()
  for (const entry of editableEntries) {
    if (entry.ownerUid === ownerUid) {
      ids.add(entry.preset.id)
    }
  }
  return ids
}

type Params = {
  user: User
  profileDisplayName: string | null
}

export function useProfileTeamsSection({ user, profileDisplayName }: Params) {
  const { t } = useTranslation('common')
  const { isAdmin } = useAuth()
  const uid = user.uid
  const [state, dispatch] = useReducer(modelReducer, initialModelState)

  const presetsByOwner = useMemo(() => {
    const nextByOwner = new Map<string, ProfileScrambleTeamPreset[]>()
    for (const entry of state.aggregatedEntries) {
      const existing = nextByOwner.get(entry.ownerUid) ?? []
      existing.push(entry.preset)
      nextByOwner.set(entry.ownerUid, existing)
    }
    return nextByOwner
  }, [state.aggregatedEntries])

  useEffect(() => {
    const unsub = subscribeAggregatedScrambleTeamPresets(
      (entries) => dispatch({ type: 'setAggregatedEntries', entries }),
      (nextError) => dispatch({ type: 'setError', error: translateUserError(t, nextError.message) }),
    )
    return () => unsub()
  }, [t])

  useEffect(() => {
    const unsub = subscribeUserDirectory(
      (entries) => dispatch({ type: 'setDirectoryEntries', entries }),
      () => {},
    )
    return () => unsub()
  }, [])

  const visibleEntries = useMemo(
    () => filterVisibleAggregatedTeamPresets(state.aggregatedEntries, uid, isAdmin),
    [isAdmin, state.aggregatedEntries, uid],
  )

  const editableEntries = useMemo(
    () => visibleEntries.filter((entry) => isAggregatedTeamPresetEditable(entry, uid, isAdmin)),
    [isAdmin, uid, visibleEntries],
  )

  const readOnlyEntries = useMemo(
    () => visibleEntries.filter((entry) => !isAggregatedTeamPresetEditable(entry, uid, isAdmin)),
    [isAdmin, uid, visibleEntries],
  )

  const editableSeed = useMemo(
    () =>
      editableEntries
        .map(
          (entry) =>
            `${entry.ownerUid}:${entry.preset.id}:${entry.preset.name}:${entry.preset.memberUids.join(',')}`,
        )
        .join('|'),
    [editableEntries],
  )

  const derivedTeams = useMemo(() => aggregatedToEditableTeams(editableEntries), [editableEntries])

  const teams =
    state.localTeamsDraft?.seed === editableSeed ? state.localTeamsDraft.teams : derivedTeams

  const setLocalTeams = useCallback(
    (nextTeams: EditableTeam[]) => {
      dispatch({ type: 'setLocalTeamsDraft', draft: { seed: editableSeed, teams: nextTeams } })
    },
    [editableSeed],
  )

  const nameByUid = useMemo(() => {
    const map = new Map<string, string>()
    for (const entry of state.directoryEntries) {
      map.set(entry.uid, memberDisplayName(entry))
    }
    return map
  }, [state.directoryEntries])

  const ownerDisplayName =
    profileDisplayName?.trim() ||
    user.displayName?.trim() ||
    user.email?.split('@')[0] ||
    t('social.youFallback')

  const memberOptions = useMemo(() => {
    const options = [{ id: uid, name: `${ownerDisplayName} (${t('profile.teams.you')})` }]
    const sortedEntries = [...state.directoryEntries]
      .filter((entry) => entry.uid !== uid)
      .sort((left, right) =>
        memberDisplayName(left).localeCompare(memberDisplayName(right), undefined, { sensitivity: 'base' }),
      )

    for (const entry of sortedEntries) {
      options.push({
        id: entry.uid,
        name: memberDisplayName(entry),
      })
    }
    return options
  }, [ownerDisplayName, state.directoryEntries, t, uid])

  const persistTeams = useCallback(
    async (nextTeams: EditableTeam[]) => {
      dispatch({ type: 'persistStart' })
      try {
        const teamsByOwner = new Map<string, EditableTeam[]>()
        for (const team of nextTeams) {
          const existing = teamsByOwner.get(team.ownerUid) ?? []
          existing.push(team)
          teamsByOwner.set(team.ownerUid, existing)
        }

        const saveTargets = isAdmin ? [...teamsByOwner.entries()] : [[uid, teamsByOwner.get(uid) ?? []] as const]

        await Promise.all(
          saveTargets.map(async ([ownerUid, ownerTeams]) => {
            const existing = presetsByOwner.get(ownerUid) ?? []
            const editableIds = editablePresetIdsForOwner(editableEntries, ownerUid)
            const merged = mergeProfileTeamPresetSave(
              existing,
              editableTeamsToPresets(ownerTeams),
              editableIds,
            )
            await saveScrambleTeamPresets({ uid: ownerUid, presets: merged })
          }),
        )

        dispatch({ type: 'persistSuccess', notice: t('profile.teams.saved') })
      } catch (nextError) {
        dispatch({
          type: 'persistError',
          error:
            nextError instanceof Error
              ? translateUserError(t, nextError.message)
              : t('profile.teams.saveFailed'),
        })
      }
    },
    [editableEntries, isAdmin, presetsByOwner, t, uid],
  )

  const onAddTeam = useCallback(() => {
    const nextTeams = [
      ...teams,
      {
        id: createProfileTeamPresetId(),
        name: t('profile.teams.defaultName', { number: teams.length + 1 }),
        participantIds: [],
        ownerUid: uid,
      },
    ]
    setLocalTeams(nextTeams)
    void persistTeams(nextTeams)
  }, [persistTeams, setLocalTeams, t, teams, uid])

  const onRemoveTeam = useCallback(
    (teamId: string) => {
      const nextTeams = removeTeam(teams, teamId) as EditableTeam[]
      setLocalTeams(nextTeams)
      void persistTeams(nextTeams)
    },
    [persistTeams, setLocalTeams, teams],
  )

  const onTeamNameChange = useCallback(
    (teamId: string, name: string) => {
      const nextTeams = teams.map((team) => (team.id === teamId ? { ...team, name } : team))
      setLocalTeams(nextTeams)
    },
    [setLocalTeams, teams],
  )

  const onTeamNameBlur = useCallback(() => {
    void persistTeams(teams)
  }, [persistTeams, teams])

  const onToggleTeamMember = useCallback(
    (teamId: string, participantId: string) => {
      const nextTeams = toggleTeamMember(teams, teamId, participantId) as EditableTeam[]
      setLocalTeams(nextTeams)
      void persistTeams(nextTeams)
    },
    [persistTeams, setLocalTeams, teams],
  )

  const readOnlySummaries = useMemo(
    () =>
      readOnlyEntries.map((entry) => ({
        id: `${entry.ownerUid}:${entry.preset.id}`,
        teamName: entry.preset.name,
        memberNames:
          entry.preset.memberUids.length > 0
            ? entry.preset.memberUids.map((memberUid) => nameByUid.get(memberUid) ?? memberUid).join(', ')
            : t('profile.teams.noMembers'),
      })),
    [nameByUid, readOnlyEntries, t],
  )

  return {
    aggregatedEntryCount: state.aggregatedEntries.length,
    directoryEntryCount: state.directoryEntries.length,
    teams,
    memberOptions,
    readOnlySummaries,
    busy: state.busy,
    error: state.error,
    notice: state.notice,
    onAddTeam,
    onRemoveTeam,
    onTeamNameChange,
    onTeamNameBlur,
    onToggleTeamMember,
    t,
  }
}
