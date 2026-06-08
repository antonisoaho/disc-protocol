import { describe, expect, it } from 'vitest'
import {
  createRoundTeamId,
  normalizeRoundTeams,
  removeParticipantFromTeams,
  removeTeam,
  toggleTeamMember,
  type RoundTeam,
} from '@core/domain/roundTeams'

describe('normalizeRoundTeams', () => {
  it('keeps valid teams with round participants only and unique membership', () => {
    const teams: RoundTeam[] = [
      { id: 'team:a', name: 'Eagles', participantIds: ['u1', 'u2', 'u9'] },
      { id: 'team:b', name: 'Birdies', participantIds: ['u2', 'u3'] },
    ]
    expect(normalizeRoundTeams(['u1', 'u2', 'u3'], teams)).toEqual([
      { id: 'team:a', name: 'Eagles', participantIds: ['u1', 'u2'] },
      { id: 'team:b', name: 'Birdies', participantIds: ['u3'] },
    ])
  })

  it('drops teams without members or invalid ids', () => {
    const teams: RoundTeam[] = [
      { id: 'bad', name: 'Nope', participantIds: ['u1'] },
      { id: 'team:empty', name: 'Empty', participantIds: [] },
      { id: 'team:ok', name: 'OK', participantIds: ['u1'] },
    ]
    expect(normalizeRoundTeams(['u1'], teams)).toEqual([
      { id: 'team:ok', name: 'OK', participantIds: ['u1'] },
    ])
  })
})

describe('toggleTeamMember', () => {
  const teams: RoundTeam[] = [{ id: 'team:a', name: 'A', participantIds: ['u1'] }]

  it('adds a participant to a team', () => {
    expect(toggleTeamMember(teams, 'team:a', 'u2')).toEqual([
      { id: 'team:a', name: 'A', participantIds: ['u1', 'u2'] },
    ])
  })

  it('removes a participant when toggled off', () => {
    expect(toggleTeamMember(teams, 'team:a', 'u1')).toEqual([
      { id: 'team:a', name: 'A', participantIds: [] },
    ])
  })

  it('moves a participant from another team', () => {
    const current: RoundTeam[] = [
      { id: 'team:a', name: 'A', participantIds: ['u1'] },
      { id: 'team:b', name: 'B', participantIds: [] },
    ]
    expect(toggleTeamMember(current, 'team:b', 'u1')).toEqual([
      { id: 'team:a', name: 'A', participantIds: [] },
      { id: 'team:b', name: 'B', participantIds: ['u1'] },
    ])
  })
})

describe('removeParticipantFromTeams', () => {
  it('removes a participant from every team', () => {
    const teams: RoundTeam[] = [
      { id: 'team:a', name: 'A', participantIds: ['u1', 'u2'] },
      { id: 'team:b', name: 'B', participantIds: ['u2'] },
    ]
    expect(removeParticipantFromTeams(teams, 'u2')).toEqual([
      { id: 'team:a', name: 'A', participantIds: ['u1'] },
      { id: 'team:b', name: 'B', participantIds: [] },
    ])
  })
})

describe('removeTeam', () => {
  it('removes a team by id', () => {
    const teams: RoundTeam[] = [
      { id: 'team:a', name: 'A', participantIds: ['u1'] },
      { id: 'team:b', name: 'B', participantIds: ['u2'] },
    ]
    expect(removeTeam(teams, 'team:a')).toEqual([{ id: 'team:b', name: 'B', participantIds: ['u2'] }])
  })
})

describe('createRoundTeamId', () => {
  it('returns ids with team prefix', () => {
    expect(createRoundTeamId().startsWith('team:')).toBe(true)
  })
})
