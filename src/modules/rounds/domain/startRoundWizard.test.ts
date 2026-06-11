import { describe, expect, it } from 'vitest'
import {
  addWizardTeam,
  applyAllSavedTeamsToWizard,
  applyOneSavedTeamToWizard,
  buildParticipantNameById,
  buildReviewTeamSummaries,
  buildSavedTeamPresetSummaries,
  removeWizardParticipantFromTeams,
  resolveInitialCourseMode,
  resolveInitialSavedCourseId,
  resolveParticipantDisplayName,
  syncWizardTeamsWithRoster,
  toggleWizardTeamMember,
  validateCourseStep,
} from '@modules/rounds/domain/startRoundWizard'

describe('validateCourseStep', () => {
  it('requires a saved course id in saved mode', () => {
    expect(
      validateCourseStep({ courseMode: 'saved', selectedSavedCourseId: 'c1', freshCourseName: '' }),
    ).toBe(true)
    expect(
      validateCourseStep({ courseMode: 'saved', selectedSavedCourseId: null, freshCourseName: '' }),
    ).toBe(false)
  })

  it('requires a non-empty fresh course name in quick mode', () => {
    expect(
      validateCourseStep({ courseMode: 'quick', selectedSavedCourseId: null, freshCourseName: 'Park' }),
    ).toBe(true)
    expect(
      validateCourseStep({ courseMode: 'quick', selectedSavedCourseId: null, freshCourseName: '   ' }),
    ).toBe(false)
  })
})

describe('resolveInitialCourseMode', () => {
  it('defaults to quick when no saved courses exist', () => {
    expect(resolveInitialCourseMode({ availableCourseIds: [], favoriteCourseIds: ['f1'] })).toBe('quick')
  })

  it('defaults to saved when courses exist', () => {
    expect(resolveInitialCourseMode({ availableCourseIds: ['c1'], favoriteCourseIds: [] })).toBe('saved')
  })
})

describe('resolveInitialSavedCourseId', () => {
  it('picks first favorite that exists in sorted list', () => {
    expect(
      resolveInitialSavedCourseId({ sortedCourseIds: ['c1', 'c2', 'c3'], favoriteCourseIds: ['c3', 'c1'] }),
    ).toBe('c3')
  })

  it('falls back to first sorted course when no favorite matches', () => {
    expect(resolveInitialSavedCourseId({ sortedCourseIds: ['c1', 'c2'], favoriteCourseIds: ['x'] })).toBe('c1')
  })
})

describe('wizard team helpers', () => {
  const nameById = new Map([
    ['owner', 'Alex'],
    ['u1', 'Sam'],
    ['u2', 'Jordan'],
  ])

  it('applies all saved presets onto the current roster', () => {
    const teams = applyAllSavedTeamsToWizard(['owner', 'u1'], [
      { id: 'preset:a', name: 'Eagles', memberUids: ['owner', 'u1', 'u9'] },
    ])
    expect(teams).toEqual([{ id: 'preset:a', name: 'Eagles', participantIds: ['owner', 'u1'] }])
  })

  it('merges a single saved preset into existing wizard teams', () => {
    const teams = applyOneSavedTeamToWizard(
      ['owner', 'u1', 'u2'],
      [{ id: 'team:local', name: 'Locals', participantIds: ['u2'] }],
      { id: 'preset:a', name: 'Eagles', memberUids: ['owner', 'u1'] },
    )
    expect(teams).toEqual([
      { id: 'team:local', name: 'Locals', participantIds: ['u2'] },
      { id: 'preset:a', name: 'Eagles', participantIds: ['owner', 'u1'] },
    ])
  })

  it('prunes wizard teams when the roster shrinks', () => {
    expect(
      syncWizardTeamsWithRoster(['owner'], [
        { id: 'preset:a', name: 'Eagles', participantIds: ['owner', 'u1'] },
      ]),
    ).toEqual([{ id: 'preset:a', name: 'Eagles', participantIds: ['owner'] }])
  })

  it('adds a blank wizard team and toggles members', () => {
    const withTeam = addWizardTeam([], 'Team 1')
    expect(withTeam).toHaveLength(1)
    expect(withTeam[0]?.participantIds).toEqual([])
    const assigned = toggleWizardTeamMember(withTeam, withTeam[0]!.id, 'owner')
    expect(assigned[0]?.participantIds).toEqual(['owner'])
  })

  it('removes a participant from all wizard teams', () => {
    expect(
      removeWizardParticipantFromTeams(
        [{ id: 'preset:a', name: 'Eagles', participantIds: ['owner', 'u1'] }],
        'u1',
      ),
    ).toEqual([{ id: 'preset:a', name: 'Eagles', participantIds: ['owner'] }])
  })

  it('builds saved preset and review summaries with directory names', () => {
    const directoryNameById = new Map([...nameById, ['u9', 'Casey']])

    expect(
      buildSavedTeamPresetSummaries(
        [
          { id: 'preset:a', name: 'Eagles', memberUids: ['owner', 'u1'] },
          { id: 'preset:b', name: 'Birdies', memberUids: ['u9'] },
        ],
        ['owner', 'u1'],
        directoryNameById,
        'Unknown player',
      ),
    ).toEqual([
      { presetId: 'preset:a', teamName: 'Eagles', memberNames: 'Alex, Sam', hasRosterMembers: true },
      { presetId: 'preset:b', teamName: 'Birdies', memberNames: 'Casey', hasRosterMembers: false },
    ])

    expect(
      buildReviewTeamSummaries(
        [{ id: 'preset:a', name: 'Eagles', participantIds: ['owner', 'u1'] }],
        nameById,
        'Unknown player',
      ),
    ).toEqual([{ name: 'Eagles', memberNames: 'Alex, Sam' }])
  })

  it('falls back to unknown label instead of raw ids', () => {
    expect(resolveParticipantDisplayName('missing', nameById, 'Unknown player')).toBe('Unknown player')
    expect(
      buildParticipantNameById({
        directoryEntries: [{ uid: 'u1', displayName: 'Sam' }],
        ownerUid: 'owner',
        ownerDisplayName: 'Alex',
        anonymousParticipants: [{ id: 'anon:1', displayName: 'Guest' }],
      }).get('anon:1'),
    ).toBe('Guest')
  })
})
