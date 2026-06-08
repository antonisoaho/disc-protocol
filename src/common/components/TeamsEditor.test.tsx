import { renderToString } from 'react-dom/server'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it } from 'vitest'

import { i18n } from '@common/i18n'
import { TeamsEditor } from '@common/components/TeamsEditor'

describe('TeamsEditor', () => {
  it('renders team footer without crashing when teams exist', () => {
    const html = renderToString(
      <I18nextProvider i18n={i18n}>
        <TeamsEditor
          titleKey="profile.teams.title"
          hintKey="profile.teams.hint"
          teamNameLabelKey="profile.teams.teamName"
          membersLabelKey="profile.teams.members"
          addTeamKey="profile.teams.addTeam"
          removeTeamKey="profile.teams.removeTeam"
          defaultTeamNameKey="profile.teams.defaultName"
          unassignedKey="profile.teams.unassigned"
          memberOptions={[{ id: 'u1', name: 'Alex' }]}
          teams={[{ id: 'preset:a', name: 'Team 1', participantIds: [] }]}
          onAddTeam={() => {}}
          onRemoveTeam={() => {}}
          onTeamNameChange={() => {}}
          onToggleTeamMember={() => {}}
          busy={false}
        />
      </I18nextProvider>,
    )

    expect(html).toContain('Team 1')
    expect(html).toContain('Add team')
  })

  it('shows compact summaries without opening the editor in wizard mode', () => {
    const html = renderToString(
      <I18nextProvider i18n={i18n}>
        <TeamsEditor
          titleKey="profile.teams.title"
          hintKey="profile.teams.hint"
          teamNameLabelKey="profile.teams.teamName"
          membersLabelKey="profile.teams.members"
          addTeamKey="profile.teams.addTeam"
          removeTeamKey="profile.teams.removeTeam"
          defaultTeamNameKey="profile.teams.defaultName"
          unassignedKey="profile.teams.unassigned"
          memberOptions={[{ id: 'u1', name: 'Alex' }]}
          teams={[{ id: 'preset:a', name: 'Team 1', participantIds: ['u1'] }]}
          onAddTeam={() => {}}
          onRemoveTeam={() => {}}
          onTeamNameChange={() => {}}
          onToggleTeamMember={() => {}}
          busy={false}
          variant="compact"
        />
      </I18nextProvider>,
    )

    expect(html).toContain('start-round-wizard__team-summary')
    expect(html).toContain('Team 1')
    expect(html).toContain('Add team')
    expect(html).not.toContain('start-round-wizard__team-card')
  })
})
