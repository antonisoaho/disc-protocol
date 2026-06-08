import { describe, expect, it } from 'vitest'
import { computeRelativeStandingById, formatRelativeStandingLabel } from '@modules/scoring/domain/scoreRowStanding'

describe('scoreRowStanding', () => {
  it('marks the leader as L and others as strokes behind', () => {
    expect(
      computeRelativeStandingById([
        { id: 'a', totals: { totalStrokes: 10, totalPar: 9, totalDelta: 1, scoredHoles: 3 } },
        { id: 'b', totals: { totalStrokes: 12, totalPar: 9, totalDelta: 3, scoredHoles: 3 } },
      ]),
    ).toEqual({ a: 'L', b: '+2' })
  })

  it('shows E for tied leaders and strokes behind for the rest', () => {
    expect(
      computeRelativeStandingById([
        { id: 'a', totals: { totalStrokes: 10, totalPar: 9, totalDelta: 1, scoredHoles: 3 } },
        { id: 'b', totals: { totalStrokes: 10, totalPar: 9, totalDelta: 1, scoredHoles: 3 } },
        { id: 'c', totals: { totalStrokes: 11, totalPar: 9, totalDelta: 2, scoredHoles: 3 } },
      ]),
    ).toEqual({ a: 'E', b: 'E', c: '+1' })
  })

  it('omits labels until at least one row has scored', () => {
    expect(
      computeRelativeStandingById([
        { id: 'a', totals: { totalStrokes: 0, totalPar: 0, totalDelta: 0, scoredHoles: 0 } },
        { id: 'b' },
      ]),
    ).toEqual({ a: '', b: '' })
  })

  it('formats a single leader as L and tied leaders as E', () => {
    expect(
      formatRelativeStandingLabel({
        totalStrokes: 9,
        scoredHoles: 2,
        leaderStrokes: 9,
        tiedLeaderCount: 1,
      }),
    ).toBe('L')
    expect(
      formatRelativeStandingLabel({
        totalStrokes: 9,
        scoredHoles: 2,
        leaderStrokes: 9,
        tiedLeaderCount: 2,
      }),
    ).toBe('E')
  })
})
