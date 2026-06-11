import { renderToString } from 'react-dom/server'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi } from 'vitest'

import { i18n } from '@common/i18n'
import { StartRoundCourseStep } from '@modules/rounds/components/StartRoundCourseStep'
import { StartRoundPlayersStep } from '@modules/rounds/components/StartRoundPlayersStep'
import { StartRoundReviewStep } from '@modules/rounds/components/StartRoundReviewStep'

vi.mock('@core/domain/courseData', () => ({
  subscribeCourses: (onData: (rows: unknown[]) => void) => {
    onData([])
    return () => {}
  },
  loadRoundSelectionForCourse: vi.fn(),
}))

vi.mock('@core/users/userDirectory', () => ({
  subscribeUserDirectory: (onData: (rows: unknown[]) => void) => {
    onData([])
    return () => {}
  },
}))

vi.mock('@core/users/follows', () => ({
  subscribeFollowing: (_uid: string, onData: (rows: unknown[]) => void) => {
    onData([])
    return () => {}
  },
  subscribeFollowers: (_uid: string, onData: (rows: unknown[]) => void) => {
    onData([])
    return () => {}
  },
}))

describe('StartRoundCourseStep', () => {
  it('renders saved and quick course mode tabs', () => {
    const html = renderToString(
      <I18nextProvider i18n={i18n}>
        <StartRoundCourseStep
          courseMode="quick"
          onCourseModeChange={() => {}}
          courseSearchQuery=""
          onCourseSearchQueryChange={() => {}}
          filteredCourses={[]}
          favoriteCourseIdSet={new Set()}
          selectedSavedCourseId={null}
          onSelectedSavedCourseIdChange={() => {}}
          freshCourseName=""
          onFreshCourseNameChange={() => {}}
          freshCourseNameError={null}
          freshCourseNameInputRef={{ current: null }}
          onFreshCourseNameInvalid={() => {}}
          freshHoleChoice={18}
          onFreshHoleChoiceChange={() => {}}
          busy={false}
          courseLoadError={null}
          noSavedCourses
        />
      </I18nextProvider>,
    )

    expect(html).toContain('Saved course')
    expect(html).toContain('New course')
    expect(html).toContain('id="start-fresh-course-name"')
  })
})

const playersStepDefaults = {
  savedTeamPresets: [],
  onApplyAllSavedTeams: () => {},
  onApplySavedTeam: () => {},
  scoringMode: 'individual' as const,
  onScoringModeChange: () => {},
  teamMemberOptions: [],
  wizardTeams: [],
  onAddTeam: () => {},
  onRemoveTeam: () => {},
  onTeamNameChange: () => {},
  onToggleTeamMember: () => {},
}

describe('StartRoundPlayersStep', () => {
  it('shows you in the roster and keeps guest add controls inside a disclosure', () => {
    const html = renderToString(
      <I18nextProvider i18n={i18n}>
        <StartRoundPlayersStep
          rosterEntries={[{ id: 'owner', name: 'Alex', kind: 'you' }]}
          onRemoveRosterEntry={() => {}}
          availableParticipants={[]}
          selectedParticipantIds={['owner']}
          onToggleParticipant={() => {}}
          participantQuery=""
          onParticipantQueryChange={() => {}}
          anonymousName=""
          onAnonymousNameChange={() => {}}
          anonymousNameError={null}
          anonymousNameInputRef={{ current: null }}
          onAnonymousNameInvalid={() => {}}
          onAddAnonymousParticipant={() => {}}
          participantDisplayName={(entry) => entry.displayName}
          busy={false}
          {...playersStepDefaults}
        />
      </I18nextProvider>,
    )

    expect(html).toContain('Alex')
    expect(html).toContain('You')
    expect(html).toContain('<details')
    expect(html).toContain('Player without account')
    expect(html).toContain('Add guest')
    expect(html).toContain('placeholder="Name"')
    expect(html).not.toContain('field__label')
    expect(html).not.toContain('scoring-panel__button--primary')
  })
})

describe('StartRoundReviewStep', () => {
  it('renders course and player summary', () => {
    const html = renderToString(
      <I18nextProvider i18n={i18n}>
        <StartRoundReviewStep
          courseMode="saved"
          savedCourseName="Maple Hill"
          quickCourseName=""
          holeCount={18}
          playerNames={['Alex', 'Sam']}
          scoringMode="scramble"
          teamSummaries={[{ name: 'Eagles', memberNames: 'Alex, Sam' }]}
        />
      </I18nextProvider>,
    )

    expect(html).toContain('Maple Hill')
    expect(html).toContain('Alex, Sam')
    expect(html).toContain('Eagles: Alex, Sam')
    expect(html).toContain('New rounds are listed on player dashboards')
  })
})

describe('StartRoundPlayersStep teams', () => {
  const twoPlayerRosterProps = {
    rosterEntries: [
      { id: 'owner', name: 'Alex', kind: 'you' as const },
      { id: 'u2', name: 'Sam', kind: 'registered' as const },
    ],
    onRemoveRosterEntry: () => {},
    availableParticipants: [],
    selectedParticipantIds: ['owner', 'u2'],
    onToggleParticipant: () => {},
    participantQuery: '',
    onParticipantQueryChange: () => {},
    anonymousName: '',
    onAnonymousNameChange: () => {},
    anonymousNameError: null,
    anonymousNameInputRef: { current: null },
    onAnonymousNameInvalid: () => {},
    onAddAnonymousParticipant: () => {},
    participantDisplayName: (entry: { displayName: string }) => entry.displayName,
    busy: false,
    savedTeamPresets: [
      {
        presetId: 'preset:a',
        teamName: 'Eagles',
        memberNames: 'Alex, Sam',
        hasRosterMembers: true,
      },
    ],
    onApplyAllSavedTeams: () => {},
    onApplySavedTeam: () => {},
    onScoringModeChange: () => {},
    teamMemberOptions: [
      { id: 'owner', name: 'Alex' },
      { id: 'u2', name: 'Sam' },
    ],
    wizardTeams: [],
    onAddTeam: () => {},
    onRemoveTeam: () => {},
    onTeamNameChange: () => {},
    onToggleTeamMember: () => {},
  }

  it('shows format choice but hides teams until scramble is selected', () => {
    const html = renderToString(
      <I18nextProvider i18n={i18n}>
        <StartRoundPlayersStep {...twoPlayerRosterProps} scoringMode="individual" />
      </I18nextProvider>,
    )

    expect(html).toContain('How are you scoring?')
    expect(html).toContain('Regular round')
    expect(html).toContain('Scramble')
    expect(html).not.toContain('Teams for this round')
  })

  it('shows collapsible team setup when scramble is selected', () => {
    const html = renderToString(
      <I18nextProvider i18n={i18n}>
        <StartRoundPlayersStep {...twoPlayerRosterProps} scoringMode="scramble" />
      </I18nextProvider>,
    )

    expect(html).toContain('<details')
    expect(html).toContain('Set up teams')
    expect(html).toContain('Your saved teams')
    expect(html).toContain('Eagles: Alex, Sam')
    expect(html).toContain('Use team')
    expect(html).toContain('Add team')
  })
})
