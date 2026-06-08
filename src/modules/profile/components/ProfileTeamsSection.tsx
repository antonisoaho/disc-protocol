import type { User } from 'firebase/auth'
import { TeamsEditor } from '@common/components/TeamsEditor'
import { useProfileTeamsSection } from '@modules/profile/hooks/useProfileTeamsSection'

type Props = {
  user: User
  profileDisplayName: string | null
}

export function ProfileTeamsSection({ user, profileDisplayName }: Props) {
  const {
    aggregatedEntryCount,
    directoryEntryCount,
    teams,
    memberOptions,
    readOnlySummaries,
    busy,
    error,
    notice,
    onAddTeam,
    onRemoveTeam,
    onTeamNameChange,
    onTeamNameBlur,
    onToggleTeamMember,
    t,
  } = useProfileTeamsSection({ user, profileDisplayName })

  return (
    <section
      className="app-shell__profile app-shell__profile--unboxed"
      aria-label={t('profile.teams.title')}
      data-aggregated-teams={aggregatedEntryCount}
      data-directory-members={directoryEntryCount}
    >
      {readOnlySummaries.length > 0 ? (
        <div className="start-round-wizard__saved-teams">
          <span className="scoring-panel__label">{t('profile.teams.clubTeamsTitle')}</span>
          <p className="scoring-panel__muted">{t('profile.teams.clubTeamsHint')}</p>
          <ul className="start-round-wizard__saved-team-list" aria-label={t('profile.teams.clubTeamsAria')}>
            {readOnlySummaries.map((team) => (
              <li key={team.id} className="start-round-wizard__saved-team-item">
                {t('profile.teams.clubTeamLine', {
                  teamName: team.teamName,
                  members: team.memberNames,
                })}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <TeamsEditor
        titleKey="profile.teams.title"
        hintKey="profile.teams.hint"
        teamNameLabelKey="profile.teams.teamName"
        membersLabelKey="profile.teams.members"
        addTeamKey="profile.teams.addTeam"
        removeTeamKey="profile.teams.removeTeam"
        defaultTeamNameKey="profile.teams.defaultName"
        unassignedKey="profile.teams.unassigned"
        memberOptions={memberOptions}
        teams={teams}
        onAddTeam={onAddTeam}
        onRemoveTeam={onRemoveTeam}
        onTeamNameChange={onTeamNameChange}
        onTeamNameBlur={onTeamNameBlur}
        onToggleTeamMember={onToggleTeamMember}
        busy={busy}
      />
      {error ? (
        <p className="app-shell__placeholder app-shell__placeholder--error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="app-shell__placeholder app-shell__placeholder--success">{notice}</p>
      ) : null}
    </section>
  )
}
