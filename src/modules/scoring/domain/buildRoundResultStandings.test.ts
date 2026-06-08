import { describe, expect, it } from 'vitest'
import {
  buildRoundResultStandings,
  pickWinnerNames,
} from '@modules/scoring/domain/buildRoundResultStandings'

describe('buildRoundResultStandings', () => {
  const units = [
    { id: 'team:a', displayName: 'The kings', scoreParticipantId: 'u1' },
    { id: 'team:b', displayName: 'BB', scoreParticipantId: 'u3' },
    { id: 'solo:c', displayName: 'Solo', scoreParticipantId: 'u5' },
  ]

  it('ranks by total strokes and assigns shared places for ties', () => {
    const standings = buildRoundResultStandings(units, {
      u1: { totalStrokes: 54, totalPar: 54, totalDelta: 0, scoredHoles: 18 },
      u3: { totalStrokes: 54, totalPar: 54, totalDelta: 0, scoredHoles: 18 },
      u5: { totalStrokes: 57, totalPar: 54, totalDelta: 3, scoredHoles: 18 },
    })

    expect(standings).toEqual([
      { id: 'team:a', displayName: 'The kings', place: 1, totalStrokes: 54, toParLabel: 'E' },
      { id: 'team:b', displayName: 'BB', place: 1, totalStrokes: 54, toParLabel: 'E' },
      { id: 'solo:c', displayName: 'Solo', place: 3, totalStrokes: 57, toParLabel: '+3' },
    ])
    expect(pickWinnerNames(standings)).toEqual(['The kings', 'BB'])
  })

  it('omits units without scored holes', () => {
    expect(
      buildRoundResultStandings(units, {
        u1: { totalStrokes: 0, totalPar: 0, totalDelta: 0, scoredHoles: 0 },
      }),
    ).toEqual([])
  })
})
