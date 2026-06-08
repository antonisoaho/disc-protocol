import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import type { UserDirectoryEntry } from '@core/users/userDirectory'

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
  busy,
}: Props) {
  const { t } = useTranslation('common')

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

      <details className="scoring-panel__disclosure">
        <summary className="scoring-panel__disclosure-summary">{t('scoring.buttons.addAnonymous')}</summary>
        <div className="scoring-panel__row scoring-panel__row--compact">
          <div className="scoring-panel__field scoring-panel__field--grow scoring-panel__field--compact field">
            <label className="scoring-panel__label field__label" htmlFor="start-new-round-anonymous-name">
              {t('rounds.new.wizard.guestNameLabel')}
            </label>
            <input
              id="start-new-round-anonymous-name"
              ref={anonymousNameInputRef}
              className={`scoring-panel__input field__control${anonymousNameError ? ' field__control--invalid' : ''}`}
              value={anonymousName}
              onChange={(event) => {
                event.currentTarget.setCustomValidity('')
                onAnonymousNameChange(event.target.value)
              }}
              onInvalid={(event) => {
                event.preventDefault()
                onAnonymousNameInvalid(event.currentTarget)
              }}
              pattern={NON_WHITESPACE_PATTERN}
              maxLength={ANONYMOUS_NAME_MAX_LENGTH}
              placeholder={t('scoring.placeholders.playerName')}
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
          </div>
          <button
            type="button"
            className="scoring-panel__button"
            onClick={onAddAnonymousParticipant}
            disabled={busy}
          >
            {t('scoring.buttons.addPlayer')}
          </button>
        </div>
      </details>
    </div>
  )
}
