import { describe, expect, it } from 'vitest'
import {
  applyProfileTeamsToRound,
  filterVisibleAggregatedTeamPresets,
  isAggregatedTeamPresetEditable,
  mergeProfileTeamPresetSave,
  normalizeProfileScrambleTeamPresets,
  normalizeWizardTeams,
  presetsToWizardTeams,
  roundTeamsFromWizard,
  wizardTeamsToPresets,
  type AggregatedScrambleTeamPreset,
} from '@core/domain/profileScrambleTeams'

const aggregated = (
  ownerUid: string,
  preset: { id: string; name: string; memberUids: string[] },
): AggregatedScrambleTeamPreset => ({ ownerUid, preset })

describe('profile team visibility', () => {
  const entries: AggregatedScrambleTeamPreset[] = [
    aggregated('admin', { id: 'preset:a', name: 'Eagles', memberUids: ['admin', 'bob'] }),
    aggregated('admin', { id: 'preset:b', name: 'Birdies', memberUids: ['carol'] }),
    aggregated('bob', { id: 'preset:c', name: 'Bobs team', memberUids: ['bob'] }),
  ]

  it('shows every team to admins', () => {
    expect(filterVisibleAggregatedTeamPresets(entries, 'admin', true)).toHaveLength(3)
  })

  it('shows only member teams to non-admins', () => {
    expect(filterVisibleAggregatedTeamPresets(entries, 'bob', false).map((entry) => entry.preset.name)).toEqual([
      'Eagles',
      'Bobs team',
    ])
  })

  it('marks other owners teams read-only for non-admins', () => {
    const eagles = entries[0]
    expect(isAggregatedTeamPresetEditable(eagles, 'bob', false)).toBe(false)
    expect(isAggregatedTeamPresetEditable(eagles, 'admin', true)).toBe(true)
    expect(isAggregatedTeamPresetEditable(entries[2], 'bob', false)).toBe(true)
  })

  it('keeps hidden presets when saving a partial update', () => {
    const existing = [
      { id: 'preset:a', name: 'Eagles', memberUids: ['admin', 'bob'] },
      { id: 'preset:b', name: 'Birdies', memberUids: ['carol'] },
    ]
    const merged = mergeProfileTeamPresetSave(
      existing,
      [{ id: 'preset:a', name: 'Eagles', memberUids: ['admin'] }],
      new Set(['preset:a']),
    )
    expect(merged).toEqual([
      { id: 'preset:b', name: 'Birdies', memberUids: ['carol'] },
      { id: 'preset:a', name: 'Eagles', memberUids: ['admin'] },
    ])
  })
})

describe('normalizeProfileScrambleTeamPresets', () => {
  it('keeps valid presets with unique members', () => {
    expect(
      normalizeProfileScrambleTeamPresets([
        { id: 'preset:a', name: 'Eagles', memberUids: ['u1', 'u2', 'u1'] },
        { id: 'preset:b', name: 'Birdies', memberUids: ['u2'] },
      ]),
    ).toEqual([
      { id: 'preset:a', name: 'Eagles', memberUids: ['u1', 'u2'] },
      { id: 'preset:b', name: 'Birdies', memberUids: [] },
    ])
  })

  it('keeps draft presets without members while editing', () => {
    expect(
      normalizeProfileScrambleTeamPresets([{ id: 'preset:new', name: 'Team 1', memberUids: [] }]),
    ).toEqual([{ id: 'preset:new', name: 'Team 1', memberUids: [] }])
  })
})

describe('applyProfileTeamsToRound', () => {
  it('creates round teams only for roster members', () => {
    const teams = applyProfileTeamsToRound(['owner', 'u1', 'u2'], [
      { id: 'preset:a', name: 'Eagles', memberUids: ['owner', 'u1', 'u9'] },
      { id: 'preset:b', name: 'Birdies', memberUids: ['u2'] },
    ])

    expect(teams).toHaveLength(2)
    expect(teams[0]?.name).toBe('Eagles')
    expect(teams[0]?.participantIds).toEqual(['owner', 'u1'])
    expect(teams[1]?.name).toBe('Birdies')
    expect(teams[1]?.participantIds).toEqual(['u2'])
  })
})

describe('wizard team helpers', () => {
  it('maps presets to wizard teams with preset ids', () => {
    expect(
      presetsToWizardTeams(['owner', 'u1'], [
        { id: 'preset:a', name: 'Eagles', memberUids: ['owner', 'u1', 'u9'] },
      ]),
    ).toEqual([{ id: 'preset:a', name: 'Eagles', participantIds: ['owner', 'u1'] }])
  })

  it('converts wizard teams to presets and round snapshots', () => {
    const wizardTeams = [{ id: 'preset:a', name: 'Eagles', participantIds: ['owner', 'u1'] }]
    expect(wizardTeamsToPresets(wizardTeams)).toEqual([
      { id: 'preset:a', name: 'Eagles', memberUids: ['owner', 'u1'] },
    ])
    const roundTeams = roundTeamsFromWizard(['owner', 'u1'], wizardTeams)
    expect(roundTeams).toHaveLength(1)
    expect(roundTeams[0]?.name).toBe('Eagles')
    expect(roundTeams[0]?.participantIds).toEqual(['owner', 'u1'])
    expect(roundTeams[0]?.id.startsWith('team:')).toBe(true)
  })

  it('prunes wizard teams when roster shrinks', () => {
    expect(
      normalizeWizardTeams(['owner'], [
        { id: 'preset:a', name: 'Eagles', participantIds: ['owner', 'u1'] },
      ]),
    ).toEqual([{ id: 'preset:a', name: 'Eagles', participantIds: ['owner'] }])
  })
})
