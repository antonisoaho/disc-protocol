import { useTranslation } from 'react-i18next'
import type { RoundTeam } from '@core/domain/roundTeams'
import { participantTeamId } from '@core/domain/roundTeams'
import type { RosterEntry } from '@modules/rounds/components/StartRoundPlayersStep'

type Props = {
  rosterEntries: RosterEntry[]
  teams: RoundTeam[]
  onAddTeam: () => void
  onRemoveTeam: (teamId: string) => void
  onTeamNameChange: (teamId: string, name: string) => void
  onToggleTeamMember: (teamId: string, participantId: string) => void
  busy: boolean
}

export function StartRoundTeamsSection({
  rosterEntries,
  teams,
  onAddTeam,
  onRemoveTeam,
  onTeamNameChange,
  onToggleTeamMember,
  busy,
}: Props) {
  const { t } = useTranslation('common')

  const assignedCount = teams.reduce((count, team) => count + team.participantIds.length, 0)
  const unassignedCount = Math.max(0, rosterEntries.length - assignedCount)

  return (
    <div className="start-round-wizard__teams">
      <span className="scoring-panel__label">{t('rounds.new.wizard.teams.title')}</span>
      <p className="scoring-panel__muted">{t('rounds.new.wizard.teams.hint')}</p>

      {teams.length === 0 ? (
        <button type="button" className="scoring-panel__button" onClick={onAddTeam} disabled={busy}>
          {t('rounds.new.wizard.teams.addTeam')}
        </button>
      ) : (
        <ul className="start-round-wizard__team-list">
          {teams.map((team) => (
            <li key={team.id} className="start-round-wizard__team-card">
              <div className="start-round-wizard__team-header">
                <label className="scoring-panel__label field__label" htmlFor={`team-name-${team.id}`}>
                  {t('rounds.new.wizard.teams.teamName')}
                </label>
                <button
                  type="button"
                  className="scoring-panel__button scoring-panel__button--inline"
                  onClick={() => onRemoveTeam(team.id)}
                  disabled={busy}
                >
                  {t('rounds.new.wizard.teams.removeTeam')}
                </button>
              </div>
              <input
                id={`team-name-${team.id}`}
                className="scoring-panel__input"
                value={team.name}
                onChange={(event) => onTeamNameChange(team.id, event.target.value)}
                autoComplete="off"
                disabled={busy}
              />
              <span className="scoring-panel__label">{t('rounds.new.wizard.teams.members')}</span>
              <div className="scoring-panel__participant-list" role="group">
                {rosterEntries.map((entry) => {
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
            </li>
          ))}
        </ul>
      )}

      {teams.length > 0 ? (
        <div className="start-round-wizard__teams-footer">
          {unassignedCount > 0 ? (
            <p className="scoring-panel__muted">
              {t('rounds.new.wizard.teams.unassigned', { count: unassignedCount })}
            </p>
          ) : null}
          <button type="button" className="scoring-panel__button" onClick={onAddTeam} disabled={busy}>
            {t('rounds.new.wizard.teams.addTeam')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
