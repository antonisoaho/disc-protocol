import { describe, expect, it } from 'vitest'
import type { CourseHoleTemplate } from '@core/domain/course'
import type { RoundDoc } from '@core/domain/round'
import {
  computeProfileTotals,
  computeProfileWinCount,
  formatMetersPlayed,
} from '@core/domain/profileTotals'

const ts = {} as RoundDoc['startedAt']

function scoreEntry(strokes: number, par: number, updatedBy: string) {
  return { strokes, par, updatedAt: ts, updatedBy }
}

function makeRound(overrides: Partial<RoundDoc>): RoundDoc {
  return {
    ownerId: 'me',
    participantIds: ['me'],
    courseId: 'course-1',
    templateId: 'template-1',
    visibility: 'public',
    startedAt: ts,
    completedAt: ts,
    holeScores: {},
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  }
}

function fullHoles(uid: string, perHoleStrokes: number[], par = 3) {
  const map: Record<string, ReturnType<typeof scoreEntry>> = {}
  perHoleStrokes.forEach((strokes, i) => {
    map[String(i + 1)] = scoreEntry(strokes, par, uid)
  })
  return map
}

const threeHoleSavedTemplate: CourseHoleTemplate[] = [
  { number: 1, par: 3, lengthMeters: 100 },
  { number: 2, par: 3, lengthMeters: 200 },
  { number: 3, par: 3, lengthMeters: 300 },
]

describe('computeProfileTotals', () => {
  it('sums throws across the user’s completed rounds', () => {
    const rounds = [
      makeRound({
        participantIds: ['me'],
        participantHoleScores: { me: fullHoles('me', [3, 4, 3]) },
      }),
      makeRound({
        participantIds: ['me'],
        participantHoleScores: { me: fullHoles('me', [4, 4, 4]) },
      }),
    ]
    const result = computeProfileTotals(rounds, 'me', new Map([['template-1', threeHoleSavedTemplate]]))
    expect(result.totalThrows).toBe(22)
  })

  it('sums meters using the saved template hole lengths', () => {
    const rounds = [
      makeRound({
        participantIds: ['me'],
        participantHoleScores: { me: fullHoles('me', [3, 3, 3]) },
      }),
    ]
    const result = computeProfileTotals(rounds, 'me', new Map([['template-1', threeHoleSavedTemplate]]))
    expect(result.totalMeters).toBe(600)
  })

  it('uses courseDraft.holes for fresh rounds', () => {
    const rounds = [
      makeRound({
        courseSource: 'fresh',
        courseDraft: {
          name: 'Backyard',
          holes: [
            { number: 1, par: 3, lengthMeters: 150 },
            { number: 2, par: 3, lengthMeters: 250 },
          ],
        },
        participantIds: ['me'],
        participantHoleScores: { me: fullHoles('me', [3, 3]) },
      }),
    ]
    const result = computeProfileTotals(rounds, 'me', new Map())
    expect(result.totalMeters).toBe(400)
    expect(result.totalThrows).toBe(6)
  })

  it('skips rounds the user did not play in', () => {
    const rounds = [
      makeRound({
        participantIds: ['other'],
        participantHoleScores: { other: fullHoles('other', [3, 3, 3]) },
      }),
    ]
    const result = computeProfileTotals(rounds, 'me', new Map([['template-1', threeHoleSavedTemplate]]))
    expect(result).toEqual({ totalThrows: 0, totalMeters: 0 })
  })

  it('ignores incomplete rounds', () => {
    const rounds = [
      makeRound({
        completedAt: null,
        participantIds: ['me'],
        participantHoleScores: { me: fullHoles('me', [3, 3, 3]) },
      }),
    ]
    const result = computeProfileTotals(rounds, 'me', new Map([['template-1', threeHoleSavedTemplate]]))
    expect(result).toEqual({ totalThrows: 0, totalMeters: 0 })
  })

  it('skips meters for holes with no known length', () => {
    const rounds = [
      makeRound({
        participantIds: ['me'],
        participantHoleScores: { me: fullHoles('me', [3, 3, 3]) },
      }),
    ]
    const templateWithMissingLength: CourseHoleTemplate[] = [
      { number: 1, par: 3, lengthMeters: 100 },
      { number: 2, par: 3, lengthMeters: null },
      { number: 3, par: 3 },
    ]
    const result = computeProfileTotals(
      rounds,
      'me',
      new Map([['template-1', templateWithMissingLength]]),
    )
    expect(result.totalThrows).toBe(9)
    expect(result.totalMeters).toBe(100)
  })
})

describe('computeProfileTotals — courseKey filter', () => {
  it('restricts totals to the selected catalog course', () => {
    const rounds = [
      makeRound({
        courseId: 'course-1',
        templateId: 'template-1',
        participantIds: ['me'],
        participantHoleScores: { me: fullHoles('me', [3, 3, 3]) },
      }),
      makeRound({
        courseId: 'course-2',
        templateId: 'template-2',
        participantIds: ['me'],
        participantHoleScores: { me: fullHoles('me', [4, 4, 4]) },
      }),
    ]
    const map = new Map<string, CourseHoleTemplate[]>([
      ['template-1', threeHoleSavedTemplate],
      ['template-2', threeHoleSavedTemplate],
    ])
    const result = computeProfileTotals(rounds, 'me', map, { courseKey: 'catalog:course-1' })
    expect(result.totalThrows).toBe(9)
    expect(result.totalMeters).toBe(600)
  })

  it('matches fresh-course key with the trimmed lowercased draft name', () => {
    const rounds = [
      makeRound({
        courseSource: 'fresh',
        courseId: 'fresh-sentinel',
        courseDraft: {
          name: ' Backyard ',
          holes: [
            { number: 1, par: 3, lengthMeters: 150 },
            { number: 2, par: 3, lengthMeters: 250 },
          ],
        },
        participantIds: ['me'],
        participantHoleScores: { me: fullHoles('me', [3, 3]) },
      }),
    ]
    const result = computeProfileTotals(rounds, 'me', new Map(), {
      courseKey: 'fresh:backyard',
    })
    expect(result.totalMeters).toBe(400)
  })

  it('returns zero when courseKey matches nothing', () => {
    const rounds = [
      makeRound({
        courseId: 'course-1',
        participantIds: ['me'],
        participantHoleScores: { me: fullHoles('me', [3, 3, 3]) },
      }),
    ]
    const result = computeProfileTotals(
      rounds,
      'me',
      new Map([['template-1', threeHoleSavedTemplate]]),
      { courseKey: 'catalog:nonexistent' },
    )
    expect(result).toEqual({ totalThrows: 0, totalMeters: 0 })
  })
})

describe('computeProfileWinCount', () => {
  it('counts a strict win against one opponent', () => {
    const rounds = [
      makeRound({
        participantIds: ['me', 'rival'],
        participantHoleScores: {
          me: fullHoles('me', [3, 3, 3]),
          rival: fullHoles('rival', [4, 4, 4]),
        },
      }),
    ]
    expect(computeProfileWinCount(rounds, 'me')).toEqual({
      wins: 1,
      comparableRounds: 1,
    })
  })

  it('does not count a tie as a win', () => {
    const rounds = [
      makeRound({
        participantIds: ['me', 'rival'],
        participantHoleScores: {
          me: fullHoles('me', [3, 3, 3]),
          rival: fullHoles('rival', [3, 3, 3]),
        },
      }),
    ]
    expect(computeProfileWinCount(rounds, 'me')).toEqual({
      wins: 0,
      comparableRounds: 1,
    })
  })

  it('does not count a loss', () => {
    const rounds = [
      makeRound({
        participantIds: ['me', 'rival'],
        participantHoleScores: {
          me: fullHoles('me', [5, 5, 5]),
          rival: fullHoles('rival', [3, 3, 3]),
        },
      }),
    ]
    expect(computeProfileWinCount(rounds, 'me')).toEqual({
      wins: 0,
      comparableRounds: 1,
    })
  })

  it('skips solo rounds (single participant counts as no comparable opponents)', () => {
    const rounds = [
      makeRound({
        participantIds: ['me'],
        participantHoleScores: { me: fullHoles('me', [3, 3, 3]) },
      }),
    ]
    expect(computeProfileWinCount(rounds, 'me')).toEqual({
      wins: 0,
      comparableRounds: 0,
    })
  })

  it('skips rounds where participants have different scored hole counts', () => {
    const rounds = [
      makeRound({
        participantIds: ['me', 'rival'],
        participantHoleScores: {
          me: fullHoles('me', [3, 3, 3]),
          rival: fullHoles('rival', [3, 3]),
        },
      }),
    ]
    expect(computeProfileWinCount(rounds, 'me')).toEqual({
      wins: 0,
      comparableRounds: 0,
    })
  })

  it('handles three players where I beat both', () => {
    const rounds = [
      makeRound({
        participantIds: ['me', 'rival', 'other'],
        participantHoleScores: {
          me: fullHoles('me', [2, 3, 3]),
          rival: fullHoles('rival', [3, 3, 3]),
          other: fullHoles('other', [4, 4, 4]),
        },
      }),
    ]
    expect(computeProfileWinCount(rounds, 'me')).toEqual({
      wins: 1,
      comparableRounds: 1,
    })
  })

  it('does not count being tied with the next-lowest as a win', () => {
    const rounds = [
      makeRound({
        participantIds: ['me', 'rival', 'other'],
        participantHoleScores: {
          me: fullHoles('me', [3, 3, 3]),
          rival: fullHoles('rival', [3, 3, 3]),
          other: fullHoles('other', [5, 5, 5]),
        },
      }),
    ]
    expect(computeProfileWinCount(rounds, 'me')).toEqual({
      wins: 0,
      comparableRounds: 1,
    })
  })

  it('ignores rounds without completedAt', () => {
    const rounds = [
      makeRound({
        completedAt: null,
        participantIds: ['me', 'rival'],
        participantHoleScores: {
          me: fullHoles('me', [3, 3, 3]),
          rival: fullHoles('rival', [4, 4, 4]),
        },
      }),
    ]
    expect(computeProfileWinCount(rounds, 'me')).toEqual({
      wins: 0,
      comparableRounds: 0,
    })
  })

  it('respects courseKey option', () => {
    const rounds = [
      makeRound({
        courseId: 'course-1',
        participantIds: ['me', 'rival'],
        participantHoleScores: {
          me: fullHoles('me', [3, 3, 3]),
          rival: fullHoles('rival', [4, 4, 4]),
        },
      }),
      makeRound({
        courseId: 'course-2',
        participantIds: ['me', 'rival'],
        participantHoleScores: {
          me: fullHoles('me', [3, 3, 3]),
          rival: fullHoles('rival', [2, 2, 2]),
        },
      }),
    ]
    expect(computeProfileWinCount(rounds, 'me', { courseKey: 'catalog:course-1' })).toEqual({
      wins: 1,
      comparableRounds: 1,
    })
    expect(computeProfileWinCount(rounds, 'me', { courseKey: 'catalog:course-2' })).toEqual({
      wins: 0,
      comparableRounds: 1,
    })
  })
})

describe('formatMetersPlayed', () => {
  it('returns em-dash when meters is 0', () => {
    expect(formatMetersPlayed(0)).toBe('—')
  })

  it('returns integer m below 1000', () => {
    expect(formatMetersPlayed(950)).toBe('950 m')
    expect(formatMetersPlayed(999)).toBe('999 m')
  })

  it('returns N.Nk m at 1000 or above', () => {
    expect(formatMetersPlayed(1000)).toBe('1.0k m')
    expect(formatMetersPlayed(1600)).toBe('1.6k m')
    expect(formatMetersPlayed(12345)).toBe('12.3k m')
  })
})
