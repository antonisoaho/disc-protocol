import { describe, expect, it } from 'vitest'
import {
  applyTeamScoreInput,
  isScrambleRound,
  readTeamScoreInput,
  resolveScrambleGridRows,
  resolveScrambleScoringUnits,
} from '@core/domain/scrambleScoring'
import type { RoundTeam } from '@core/domain/roundTeams'

const teamA: RoundTeam = {
  id: 'team:aaa',
  name: 'Eagles',
  participantIds: ['u1', 'u2'],
}

const teamB: RoundTeam = {
  id: 'team:bbb',
  name: 'Birdies',
  participantIds: ['u3'],
}

describe('scrambleScoring', () => {
  it('detects scramble rounds from scoringMode and legacy teams', () => {
    expect(isScrambleRound(['u1', 'u2'], { scoringMode: 'scramble', teams: [] })).toBe(true)
    expect(isScrambleRound(['u1'], { scoringMode: 'individual', teams: [teamA] })).toBe(false)
    expect(isScrambleRound(['u1', 'u2'], { teams: [teamA] })).toBe(true)
    expect(isScrambleRound(['u1'], { teams: [] })).toBe(false)
  })

  it('resolves team and solo scoring units', () => {
    const units = resolveScrambleScoringUnits({
      participantIds: ['u1', 'u2', 'u3', 'u4'],
      teams: [teamA, teamB],
      participantNames: { u1: 'A', u2: 'B', u3: 'C', u4: 'D' },
    })
    expect(units).toEqual([
      { kind: 'team', teamId: 'team:aaa', name: 'Eagles', participantIds: ['u1', 'u2'] },
      { kind: 'team', teamId: 'team:bbb', name: 'Birdies', participantIds: ['u3'] },
      { kind: 'solo', participantId: 'u4', name: 'D' },
    ])
  })

  it('reads and applies one team score across all members', () => {
    const inputs = { u1: '4', u2: '', u3: '3' }
    expect(readTeamScoreInput(teamA, inputs)).toBe('4')
    expect(applyTeamScoreInput(teamA, '5', inputs)).toEqual({
      u1: '5',
      u2: '5',
      u3: '3',
    })
  })

  it('keeps earlier team scores when another team is edited in sequence', () => {
    const teamAm: RoundTeam = {
      id: 'team:am',
      name: 'AM',
      participantIds: ['u1', 'u2'],
    }
    const teamLarssons: RoundTeam = {
      id: 'team:larssons',
      name: 'Larssons',
      participantIds: ['u3', 'u4'],
    }
    let inputs: Record<string, string> = { u1: '', u2: '', u3: '', u4: '' }
    inputs = applyTeamScoreInput(teamAm, '4', inputs)
    inputs = applyTeamScoreInput(teamLarssons, '5', inputs)
    expect(inputs).toEqual({
      u1: '4',
      u2: '4',
      u3: '5',
      u4: '5',
    })
  })

  it('builds scorecard rows with one row per team plus unassigned players', () => {
    const rows = resolveScrambleGridRows({
      participantIds: ['u1', 'u2', 'u3', 'u4'],
      teams: [teamA],
      participantNames: { u1: 'A', u2: 'B', u3: 'C', u4: 'D' },
    })
    expect(rows).toEqual([
      { rowId: 'team:aaa', displayName: 'Eagles', scoreParticipantId: 'u1' },
      { rowId: 'u3', displayName: 'C', scoreParticipantId: 'u3' },
      { rowId: 'u4', displayName: 'D', scoreParticipantId: 'u4' },
    ])
  })
})
