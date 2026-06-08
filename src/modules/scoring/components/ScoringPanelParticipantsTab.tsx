import type { RefObject } from 'react'
import type { ParticipantTotals, ScorecardGrandTotals } from '@core/domain/scorecardTable'
import type { RoundDoc } from '@core/domain/round'
import {
  isAnonymousParticipantId,
  normalizeAnonymousParticipantName,
} from '@core/domain/participantRoster'
import type { UserDirectoryEntry } from '@core/users/userDirectory'
import {
  formatScoringDelta,
  SCORING_PANEL_ANONYMOUS_NAME_MAX_LENGTH,
  SCORING_PANEL_NON_WHITESPACE_PATTERN,
  scoringParticipantDisplayName,
} from '@modules/scoring/domain/scoringPanelFormat'
import { useTranslation } from 'react-i18next'

type Props = {
  selected: { data: RoundDoc }
  selectedParticipantTotals: Record<string, ParticipantTotals>
  selectedParticipantNames: Record<string, string>
  selectedGrandTotals: ScorecardGrandTotals
  canManageRoundRoster: boolean
  busy: boolean
  rosterReplaceFromId: string | null
  setRosterReplaceFromId: (value: string | null) => void
  rosterReplaceQuery: string
  setRosterReplaceQuery: (value: string) => void
  rosterReplaceTargetUid: string | null
  setRosterReplaceTargetUid: (value: string | null) => void
  rosterReplaceCandidateEntries: UserDirectoryEntry[]
  onRemoveRoundParticipant: (participantId: string) => void | Promise<void>
  onReplaceRoundParticipant: () => void | Promise<void>
  inviteParticipantQuery: string
  setInviteParticipantQuery: (value: string) => void
  inviteSelections: string[]
  setInviteSelections: (updater: (current: string[]) => string[]) => void
  inviteCandidateEntries: UserDirectoryEntry[]
  inviteAnonymousName: string
  setInviteAnonymousName: (value: string) => void
  inviteAnonymousNameError: string | null
  setInviteAnonymousNameError: (value: string | null) => void
  inviteAnonymousNameInputRef: RefObject<HTMLInputElement | null>
  resolveAnonymousNameError: (input: HTMLInputElement) => string
  onAddParticipant: () => void | Promise<void>
}

export function ScoringPanelParticipantsTab({
  selected,
  selectedParticipantTotals,
  selectedParticipantNames,
  selectedGrandTotals,
  canManageRoundRoster,
  busy,
  rosterReplaceFromId,
  setRosterReplaceFromId,
  rosterReplaceQuery,
  setRosterReplaceQuery,
  rosterReplaceTargetUid,
  setRosterReplaceTargetUid,
  rosterReplaceCandidateEntries,
  onRemoveRoundParticipant,
  onReplaceRoundParticipant,
  inviteParticipantQuery,
  setInviteParticipantQuery,
  inviteSelections,
  setInviteSelections,
  inviteCandidateEntries,
  inviteAnonymousName,
  setInviteAnonymousName,
  inviteAnonymousNameError,
  setInviteAnonymousNameError,
  inviteAnonymousNameInputRef,
  resolveAnonymousNameError,
  onAddParticipant,
}: Props) {
  const { t } = useTranslation('common')

  return (
    <div className="scoring-panel__section">
      <span className="scoring-panel__label">{t('scoring.sections.roundParticipants')}</span>
      <ul className="scoring-panel__list">
        {selected.data.participantIds.map((participantId) => {
          const totals = selectedParticipantTotals[participantId] ?? {
            totalStrokes: 0,
            totalPar: 0,
            totalDelta: 0,
            scoredHoles: 0,
          }
          const isAnonymous = isAnonymousParticipantId(participantId)
          const canRosterEditRow = canManageRoundRoster && participantId !== selected.data.ownerId
          const replacePanelOpen = rosterReplaceFromId === participantId
          return (
            <li
              key={participantId}
              className={`scoring-panel__list-item${replacePanelOpen ? ' scoring-panel__list-item--stacked' : ''}`}
            >
              <div className="scoring-panel__list-item-main">
                <div>
                  <strong>{selectedParticipantNames[participantId] ?? participantId}</strong>
                  <p className="scoring-panel__muted">
                    {isAnonymous ? t('scoring.labels.anonymousParticipant') : participantId}
                  </p>
                </div>
                <p className="scoring-panel__muted">
                  {t('scoring.participants.playerSummary', {
                    totalStrokes: totals.totalStrokes,
                    totalPar: totals.totalPar,
                    totalDelta: formatScoringDelta(totals.totalDelta),
                    scoredHoles: totals.scoredHoles,
                  })}
                </p>
                {canRosterEditRow ? (
                  <div className="scoring-panel__list-item-actions">
                    <button
                      type="button"
                      className="scoring-panel__button scoring-panel__button--inline"
                      disabled={busy}
                      onClick={() => {
                        setRosterReplaceFromId(participantId)
                        setRosterReplaceQuery('')
                        setRosterReplaceTargetUid(null)
                      }}
                    >
                      {t('scoring.buttons.replaceParticipant')}
                    </button>
                    <button
                      type="button"
                      className="scoring-panel__button scoring-panel__button--inline"
                      disabled={busy}
                      onClick={() => void onRemoveRoundParticipant(participantId)}
                    >
                      {t('scoring.buttons.removeParticipant')}
                    </button>
                  </div>
                ) : null}
              </div>
              {replacePanelOpen ? (
                <div
                  className="scoring-panel__list-item-replace"
                  role="region"
                  aria-label={t('scoring.aria.replaceParticipantPanel')}
                >
                  <p className="scoring-panel__muted">{t('scoring.participants.replaceIntro')}</p>
                  <div className="scoring-panel__field scoring-panel__field--grow">
                    <label className="scoring-panel__label" htmlFor="roster-replace-search">
                      {t('scoring.participants.replaceSearchLabel')}
                    </label>
                    <input
                      id="roster-replace-search"
                      className="scoring-panel__input"
                      value={rosterReplaceQuery}
                      onChange={(event) => setRosterReplaceQuery(event.target.value)}
                      placeholder={t('scoring.participants.replaceSearchPlaceholder')}
                      autoComplete="off"
                    />
                    <div
                      className="scoring-panel__participant-list"
                      role="radiogroup"
                      aria-label={t('scoring.aria.replaceParticipantChoices')}
                    >
                      {rosterReplaceCandidateEntries.map((entry) => (
                        <label key={entry.uid} className="scoring-panel__participant-option">
                          <input
                            type="radio"
                            name="roster-replace-target"
                            value={entry.uid}
                            checked={rosterReplaceTargetUid === entry.uid}
                            disabled={busy}
                            onChange={() => setRosterReplaceTargetUid(entry.uid)}
                          />
                          <span>{scoringParticipantDisplayName(entry)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="scoring-panel__row scoring-panel__row--compact">
                    <button
                      type="button"
                      className="scoring-panel__button scoring-panel__button--primary"
                      disabled={busy || !rosterReplaceTargetUid}
                      onClick={() => void onReplaceRoundParticipant()}
                    >
                      {t('scoring.buttons.confirmReplace')}
                    </button>
                    <button
                      type="button"
                      className="scoring-panel__button"
                      disabled={busy}
                      onClick={() => {
                        setRosterReplaceFromId(null)
                        setRosterReplaceQuery('')
                        setRosterReplaceTargetUid(null)
                      }}
                    >
                      {t('scoring.buttons.cancelReplace')}
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
      {selected.data.teams && selected.data.teams.length > 0 ? (
        <div className="scoring-panel__field">
          <span className="scoring-panel__label">{t('scoring.participants.teams')}</span>
          <ul className="scoring-panel__list">
            {selected.data.teams.map((team) => (
              <li key={team.id} className="scoring-panel__list-item">
                {t('scoring.participants.teamLine', {
                  teamName: team.name,
                  members: team.participantIds
                    .map((participantId) => selectedParticipantNames[participantId] ?? participantId)
                    .join(', '),
                })}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="scoring-panel__muted">
        {t('scoring.participants.grandTotal', {
          totalStrokes: selectedGrandTotals.totalStrokes,
          totalPar: selectedGrandTotals.totalPar,
          totalDelta: formatScoringDelta(selectedGrandTotals.totalDelta),
          count: selectedGrandTotals.participantCount,
          participantCount: selectedGrandTotals.participantCount,
        })}
      </p>
      {canManageRoundRoster ? (
        <div className="scoring-panel__scorecard-participants">
          <div className="scoring-panel__field scoring-panel__field--grow">
            <label className="scoring-panel__label" htmlFor="invite-search">
              {t('scoring.participants.addParticipants')}
            </label>
            <input
              id="invite-search"
              className="scoring-panel__input"
              value={inviteParticipantQuery}
              onChange={(event) => setInviteParticipantQuery(event.target.value)}
              placeholder={t('scoring.participants.searchUsersPlaceholder')}
              autoComplete="off"
            />
            <div className="scoring-panel__participant-list" role="group" aria-label={t('scoring.aria.inviteParticipants')}>
              {inviteCandidateEntries.map((entry) => {
                const checked = inviteSelections.includes(entry.uid)
                return (
                  <label key={entry.uid} className="scoring-panel__participant-option">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={busy}
                      onChange={() =>
                        setInviteSelections((current) =>
                          current.includes(entry.uid)
                            ? current.filter((value) => value !== entry.uid)
                            : [...current, entry.uid],
                        )
                      }
                    />
                    <span>{scoringParticipantDisplayName(entry)}</span>
                  </label>
                )
              })}
            </div>
            <div className="scoring-panel__row scoring-panel__row--compact">
              <div className="scoring-panel__field scoring-panel__field--grow scoring-panel__field--compact field">
                <label className="scoring-panel__label field__label" htmlFor="invite-anonymous-name">
                  {t('scoring.labels.playerNameOptional')}
                </label>
                <input
                  id="invite-anonymous-name"
                  ref={inviteAnonymousNameInputRef}
                  className={`scoring-panel__input field__control${
                    inviteAnonymousNameError ? ' field__control--invalid' : ''
                  }`}
                  value={inviteAnonymousName}
                  onChange={(event) => {
                    event.currentTarget.setCustomValidity('')
                    setInviteAnonymousName(event.target.value)
                    if (inviteAnonymousNameError && event.currentTarget.validity.valid) {
                      setInviteAnonymousNameError(null)
                    }
                  }}
                  onInvalid={(event) => {
                    event.preventDefault()
                    setInviteAnonymousNameError(resolveAnonymousNameError(event.currentTarget))
                  }}
                  pattern={`(?:${SCORING_PANEL_NON_WHITESPACE_PATTERN})?`}
                  maxLength={SCORING_PANEL_ANONYMOUS_NAME_MAX_LENGTH}
                  placeholder={t('scoring.placeholders.playerName')}
                  autoComplete="off"
                  aria-invalid={inviteAnonymousNameError ? 'true' : 'false'}
                  aria-describedby={inviteAnonymousNameError ? 'invite-anonymous-name-error' : undefined}
                />
                {inviteAnonymousNameError ? (
                  <p id="invite-anonymous-name-error" className="field__error" role="alert">
                    {inviteAnonymousNameError}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="scoring-panel__button scoring-panel__button--primary scoring-panel__button--participant-submit"
            onClick={() => void onAddParticipant()}
            disabled={
              busy ||
              (inviteSelections.length === 0 &&
                normalizeAnonymousParticipantName(inviteAnonymousName).length === 0)
            }
          >
            {t('scoring.buttons.addPlayer')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
