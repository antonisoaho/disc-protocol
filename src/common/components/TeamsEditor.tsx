import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { participantTeamId, type RoundTeam } from '@core/domain/roundTeams'

export type TeamMemberOption = {
  id: string
  name: string
}

type Props = {
  titleKey: string
  hintKey: string
  teamNameLabelKey: string
  membersLabelKey: string
  addTeamKey: string
  removeTeamKey: string
  editTeamKey?: string
  doneEditingKey?: string
  defaultTeamNameKey: string
  unassignedKey: string
  memberOptions: TeamMemberOption[]
  teams: RoundTeam[]
  onAddTeam: () => void
  onRemoveTeam: (teamId: string) => void
  onTeamNameChange: (teamId: string, name: string) => void
  onTeamNameBlur?: () => void
  onToggleTeamMember: (teamId: string, participantId: string) => void
  busy: boolean
  /** Wizard: compact summaries + editor only while adding/editing. */
  variant?: 'expanded' | 'compact'
}

function memberName(memberOptions: TeamMemberOption[], participantId: string): string {
  return memberOptions.find((entry) => entry.id === participantId)?.name ?? participantId
}

function formatTeamMemberSummary(team: RoundTeam, memberOptions: TeamMemberOption[], emptyLabel: string): string {
  if (team.participantIds.length === 0) {
    return emptyLabel
  }
  return team.participantIds.map((participantId) => memberName(memberOptions, participantId)).join(', ')
}

type TeamEditorCardProps = {
  team: RoundTeam
  teamNameLabelKey: string
  membersLabelKey: string
  removeTeamKey: string
  memberOptions: TeamMemberOption[]
  teams: RoundTeam[]
  busy: boolean
  onRemoveTeam: (teamId: string) => void
  onTeamNameChange: (teamId: string, name: string) => void
  onTeamNameBlur?: () => void
  onToggleTeamMember: (teamId: string, participantId: string) => void
  showDone?: boolean
  doneEditingKey?: string
  onDoneEditing?: () => void
}

function TeamEditorCard({
  team,
  teamNameLabelKey,
  membersLabelKey,
  removeTeamKey,
  memberOptions,
  teams,
  busy,
  onRemoveTeam,
  onTeamNameChange,
  onTeamNameBlur,
  onToggleTeamMember,
  showDone,
  doneEditingKey,
  onDoneEditing,
}: TeamEditorCardProps) {
  const { t } = useTranslation('common')

  return (
    <li className="start-round-wizard__team-card">
      <div className="start-round-wizard__team-header">
        <label className="scoring-panel__label field__label" htmlFor={`team-name-${team.id}`}>
          {t(teamNameLabelKey)}
        </label>
        <button
          type="button"
          className="scoring-panel__button scoring-panel__button--inline"
          onClick={() => onRemoveTeam(team.id)}
          disabled={busy}
        >
          {t(removeTeamKey)}
        </button>
      </div>
      <input
        id={`team-name-${team.id}`}
        className="scoring-panel__input"
        value={team.name}
        onChange={(event) => onTeamNameChange(team.id, event.target.value)}
        onBlur={() => onTeamNameBlur?.()}
        autoComplete="off"
        disabled={busy}
      />
      <span className="scoring-panel__label">{t(membersLabelKey)}</span>
      <div className="scoring-panel__participant-list" role="group">
        {memberOptions.map((entry) => {
          const checked = team.participantIds.includes(entry.id)
          const assignedTeamId = participantTeamId(teams, entry.id)
          const disabled = busy || (assignedTeamId !== null && assignedTeamId !== team.id)
          return (
            <label key={`${team.id}-${entry.id}`} className="scoring-panel__participant-option">
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => onToggleTeamMember(team.id, entry.id)}
              />
              <span>{entry.name}</span>
            </label>
          )
        })}
      </div>
      {showDone && doneEditingKey && onDoneEditing ? (
        <button type="button" className="scoring-panel__button" onClick={onDoneEditing} disabled={busy}>
          {t(doneEditingKey)}
        </button>
      ) : null}
    </li>
  )
}

export function TeamsEditor({
  titleKey,
  hintKey,
  teamNameLabelKey,
  membersLabelKey,
  addTeamKey,
  removeTeamKey,
  editTeamKey = 'profile.teams.editTeam',
  doneEditingKey = 'profile.teams.doneEditing',
  unassignedKey,
  memberOptions,
  teams,
  onAddTeam,
  onRemoveTeam,
  onTeamNameChange,
  onTeamNameBlur,
  onToggleTeamMember,
  busy,
  variant = 'expanded',
}: Props) {
  const { t } = useTranslation('common')
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const prevTeamCountRef = useRef(teams.length)

  useEffect(() => {
    if (variant !== 'compact') {
      return
    }
    const addedCount = teams.length - prevTeamCountRef.current
    if (addedCount === 1) {
      setEditingTeamId(teams[teams.length - 1]!.id)
    }
    prevTeamCountRef.current = teams.length
  }, [teams, variant])

  const assignedCount = teams.reduce((count, team) => count + team.participantIds.length, 0)
  const unassignedCount = Math.max(0, memberOptions.length - assignedCount)
  const emptyMembersLabel = t('profile.teams.noMembers')
  const activeEditingTeamId =
    editingTeamId && teams.some((team) => team.id === editingTeamId) ? editingTeamId : null
  const editingTeam = activeEditingTeamId
    ? teams.find((team) => team.id === activeEditingTeamId)
    : null
  const summaryTeams =
    variant === 'compact' ? teams.filter((team) => team.id !== activeEditingTeamId) : teams

  const handleRemoveTeam = (teamId: string) => {
    onRemoveTeam(teamId)
    if (editingTeamId === teamId) {
      setEditingTeamId(null)
    }
  }

  return (
    <div className="start-round-wizard__teams" data-editing-team-id={editingTeamId ?? ''}>
      <span className="scoring-panel__label">{t(titleKey)}</span>
      <p className="scoring-panel__muted">{t(hintKey)}</p>

      {variant === 'compact' && summaryTeams.length > 0 ? (
        <ul className="start-round-wizard__team-summary-list" aria-label={t(titleKey)}>
          {summaryTeams.map((team) => (
            <li key={team.id} className="start-round-wizard__team-summary">
              <span className="start-round-wizard__team-summary-text">
                <strong>{team.name}</strong>
                <span className="scoring-panel__muted">
                  {formatTeamMemberSummary(team, memberOptions, emptyMembersLabel)}
                </span>
              </span>
              <div className="start-round-wizard__team-summary-actions">
                <button
                  type="button"
                  className="scoring-panel__button scoring-panel__button--inline"
                  onClick={() => setEditingTeamId(team.id)}
                  disabled={busy}
                >
                  {t(editTeamKey)}
                </button>
                <button
                  type="button"
                  className="scoring-panel__button scoring-panel__button--inline"
                  onClick={() => handleRemoveTeam(team.id)}
                  disabled={busy}
                >
                  {t(removeTeamKey)}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {variant === 'expanded' && teams.length > 0 ? (
        <ul className="start-round-wizard__team-list">
          {teams.map((team) => (
            <TeamEditorCard
              key={team.id}
              team={team}
              teamNameLabelKey={teamNameLabelKey}
              membersLabelKey={membersLabelKey}
              removeTeamKey={removeTeamKey}
              memberOptions={memberOptions}
              teams={teams}
              busy={busy}
              onRemoveTeam={handleRemoveTeam}
              onTeamNameChange={onTeamNameChange}
              onTeamNameBlur={onTeamNameBlur}
              onToggleTeamMember={onToggleTeamMember}
            />
          ))}
        </ul>
      ) : null}

      {variant === 'compact' && editingTeam ? (
        <ul className="start-round-wizard__team-list">
          <TeamEditorCard
            team={editingTeam}
            teamNameLabelKey={teamNameLabelKey}
            membersLabelKey={membersLabelKey}
            removeTeamKey={removeTeamKey}
            memberOptions={memberOptions}
            teams={teams}
            busy={busy}
            onRemoveTeam={handleRemoveTeam}
            onTeamNameChange={onTeamNameChange}
            onTeamNameBlur={onTeamNameBlur}
            onToggleTeamMember={onToggleTeamMember}
            showDone
            doneEditingKey={doneEditingKey}
            onDoneEditing={() => setEditingTeamId(null)}
          />
        </ul>
      ) : null}

      {variant === 'expanded' && teams.length === 0 ? (
        <button type="button" className="scoring-panel__button" onClick={onAddTeam} disabled={busy}>
          {t(addTeamKey)}
        </button>
      ) : null}

      {variant === 'compact' && !editingTeam ? (
        <button type="button" className="scoring-panel__button" onClick={onAddTeam} disabled={busy}>
          {t(addTeamKey)}
        </button>
      ) : null}

      {variant === 'expanded' && teams.length > 0 ? (
        <div className="start-round-wizard__teams-footer">
          {unassignedCount > 0 ? (
            <p className="scoring-panel__muted">{t(unassignedKey, { count: unassignedCount })}</p>
          ) : null}
          <button type="button" className="scoring-panel__button" onClick={onAddTeam} disabled={busy}>
            {t(addTeamKey)}
          </button>
        </div>
      ) : null}

      {variant === 'compact' && teams.length > 0 && !editingTeam && unassignedCount > 0 ? (
        <p className="scoring-panel__muted">{t(unassignedKey, { count: unassignedCount })}</p>
      ) : null}
    </div>
  )
}
