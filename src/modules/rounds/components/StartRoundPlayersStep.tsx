import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { TeamsEditor, type TeamMemberOption } from '@common/components/TeamsEditor'
import type { RoundTeam } from '@core/domain/roundTeams'
import type { UserDirectoryEntry } from '@core/users/userDirectory'
import type { SavedTeamPresetSummary } from '@modules/rounds/domain/startRoundWizard'

export type RosterEntry = {
  id: string
  name: string
  kind: 'you' | 'registered' | 'guest'
}

type Props = {
  rosterEntries: RosterEntry[]
  onRemoveRosterEntry: (entry: RosterEntry) => void
  availableParticipants: UserDirectoryEntry[]
  selectedParticipantIds: string[]
  onToggleParticipant: (participantId: string) => void
  participantQuery: string
  onParticipantQueryChange: (value: string) => void
  anonymousName: string
  onAnonymousNameChange: (value: string) => void
  anonymousNameError: string | null
  anonymousNameInputRef: RefObject<HTMLInputElement | null>
  onAnonymousNameInvalid: (input: HTMLInputElement) => void
  onAddAnonymousParticipant: () => void
  participantDisplayName: (entry: UserDirectoryEntry) => string
  savedTeamPresets: SavedTeamPresetSummary[]
  onApplyAllSavedTeams: () => void
  onApplySavedTeam: (presetId: string) => void
  teamMemberOptions: TeamMemberOption[]
  wizardTeams: RoundTeam[]
  onAddTeam: () => void
  onRemoveTeam: (teamId: string) => void
  onTeamNameChange: (teamId: string, name: string) => void
  onToggleTeamMember: (teamId: string, participantId: string) => void
  busy: boolean
}

const ANONYMOUS_NAME_MAX_LENGTH = 80
const NON_WHITESPACE_PATTERN = '.*\\S.*'

export function StartRoundPlayersStep({
  rosterEntries,
  onRemoveRosterEntry,
  availableParticipants,
  selectedParticipantIds,
  onToggleParticipant,
  participantQuery,
  onParticipantQueryChange,
  anonymousName,
  onAnonymousNameChange,
  anonymousNameError,
  anonymousNameInputRef,
  onAnonymousNameInvalid,
  onAddAnonymousParticipant,
  participantDisplayName,
  savedTeamPresets,
  onApplyAllSavedTeams,
  onApplySavedTeam,
  teamMemberOptions,
  wizardTeams,
  onAddTeam,
  onRemoveTeam,
  onTeamNameChange,
  onToggleTeamMember,
  busy,
}: Props) {
  const { t } = useTranslation('common')
  const showTeams = rosterEntries.length >= 2
  const applicableSavedTeams = savedTeamPresets.filter((preset) => preset.hasRosterMembers)

  return (
    <div className="scoring-panel__section">
      <span className="scoring-panel__label">{t('rounds.new.wizard.roster.title')}</span>
      <ul className="start-round-wizard__roster" aria-label={t('rounds.new.wizard.roster.title')}>
        {rosterEntries.map((entry) => (
          <li
            key={entry.id}
            className={`start-round-wizard__roster-chip${
              entry.kind === 'you' ? ' start-round-wizard__roster-chip--you' : ''
            }`}
          >
            <span>{entry.name}</span>
            {entry.kind === 'you' ? (
              <span className="start-round-wizard__roster-badge">{t('rounds.new.wizard.roster.you')}</span>
            ) : null}
            {entry.kind === 'guest' ? (
              <span className="start-round-wizard__roster-badge">{t('rounds.new.wizard.roster.guestBadge')}</span>
            ) : null}
            {entry.kind !== 'you' ? (
              <button
                type="button"
                className="scoring-panel__button scoring-panel__button--inline"
                onClick={() => onRemoveRosterEntry(entry)}
                disabled={busy}
              >
                {t('scoring.buttons.removeAnonymous')}
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="scoring-panel__field scoring-panel__field--grow">
        <label className="scoring-panel__label" htmlFor="start-participant-search">
          {t('scoring.start.participants')}
        </label>
        <input
          id="start-participant-search"
          className="scoring-panel__input"
          value={participantQuery}
          onChange={(event) => onParticipantQueryChange(event.target.value)}
          placeholder={t('scoring.start.searchParticipantsPlaceholder')}
          autoComplete="off"
          disabled={busy}
        />
        <div
          className="scoring-panel__participant-list"
          role="group"
          aria-label={t('scoring.aria.selectRoundParticipants')}
        >
          {availableParticipants.map((entry) => {
            const checked = selectedParticipantIds.includes(entry.uid)
            return (
              <label key={entry.uid} className="scoring-panel__participant-option">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={busy}
                  onChange={() => onToggleParticipant(entry.uid)}
                />
                <span>{participantDisplayName(entry)}</span>
              </label>
            )
          })}
        </div>
      </div>

      <details className="scoring-panel__disclosure start-round-wizard__guest-disclosure">
        <summary className="scoring-panel__disclosure-summary">{t('scoring.buttons.addAnonymous')}</summary>
        <div className="start-round-wizard__guest-form">
          <input
            id="start-new-round-anonymous-name"
            ref={anonymousNameInputRef}
            className={`scoring-panel__input start-round-wizard__guest-input${
              anonymousNameError ? ' field__control--invalid' : ''
            }`}
            value={anonymousName}
            onChange={(event) => {
              event.currentTarget.setCustomValidity('')
              onAnonymousNameChange(event.target.value)
            }}
            onInvalid={(event) => {
              event.preventDefault()
              onAnonymousNameInvalid(event.currentTarget)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                onAddAnonymousParticipant()
              }
            }}
            pattern={NON_WHITESPACE_PATTERN}
            maxLength={ANONYMOUS_NAME_MAX_LENGTH}
            placeholder={t('rounds.new.wizard.guestNamePlaceholder')}
            aria-label={t('rounds.new.wizard.guestNameLabel')}
            autoComplete="off"
            aria-invalid={anonymousNameError ? 'true' : 'false'}
            aria-describedby={anonymousNameError ? 'start-new-round-anonymous-name-error' : undefined}
            disabled={busy}
          />
          {anonymousNameError ? (
            <p id="start-new-round-anonymous-name-error" className="field__error" role="alert">
              {anonymousNameError}
            </p>
          ) : null}
          <button
            type="button"
            className="scoring-panel__button start-round-wizard__guest-add"
            onClick={onAddAnonymousParticipant}
            disabled={busy}
          >
            {t('rounds.new.wizard.addGuest')}
          </button>
        </div>
      </details>

      {showTeams && savedTeamPresets.length > 0 ? (
        <div className="start-round-wizard__saved-teams">
          <span className="scoring-panel__label">{t('rounds.new.wizard.format.savedTeamsTitle')}</span>
          <p className="scoring-panel__muted">{t('rounds.new.wizard.format.savedTeamsHint')}</p>
          <ul
            className="start-round-wizard__saved-team-list"
            aria-label={t('rounds.new.wizard.format.savedTeamsAria')}
          >
            {savedTeamPresets.map((preset) => (
              <li key={preset.presetId} className="start-round-wizard__saved-team-item">
                <span>
                  {t('rounds.new.wizard.format.savedTeamLine', {
                    teamName: preset.teamName,
                    members: preset.memberNames || t('rounds.new.wizard.format.savedTeamNoMembers'),
                  })}
                </span>
                <button
                  type="button"
                  className="scoring-panel__button scoring-panel__button--inline"
                  onClick={() => onApplySavedTeam(preset.presetId)}
                  disabled={busy || !preset.hasRosterMembers}
                >
                  {t('rounds.new.wizard.format.useSavedTeam')}
                </button>
              </li>
            ))}
          </ul>
          {applicableSavedTeams.length > 1 ? (
            <button
              type="button"
              className="scoring-panel__button"
              onClick={onApplyAllSavedTeams}
              disabled={busy}
            >
              {t('rounds.new.wizard.format.applySavedTeams')}
            </button>
          ) : null}
        </div>
      ) : null}

      {showTeams ? (
        <TeamsEditor
          titleKey="rounds.new.wizard.format.teamsEditorTitle"
          hintKey="rounds.new.wizard.format.teamsEditorHint"
          teamNameLabelKey="profile.teams.teamName"
          membersLabelKey="profile.teams.members"
          addTeamKey="profile.teams.addTeam"
          removeTeamKey="profile.teams.removeTeam"
          defaultTeamNameKey="profile.teams.defaultName"
          unassignedKey="profile.teams.unassigned"
          memberOptions={teamMemberOptions}
          teams={wizardTeams}
          onAddTeam={onAddTeam}
          onRemoveTeam={onRemoveTeam}
          onTeamNameChange={onTeamNameChange}
          onToggleTeamMember={onToggleTeamMember}
          busy={busy}
          variant="compact"
        />
      ) : null}
    </div>
  )
}
