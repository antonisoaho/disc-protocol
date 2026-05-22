import { describe, expect, it } from 'vitest'
import type { Timestamp } from 'firebase/firestore'
import type { RoundDoc } from '@core/domain/round'
import type { IdRound } from '@core/domain/roundAnalytics'
import {
  computeCourseHighscores,
  computeCourseOverviewStats,
} from '@core/domain/courseHighscores'

const ts = {} as Timestamp

function tsAt(millis: number): Timestamp {
  return { toMillis: () => millis } as unknown as Timestamp
}

function scoreEntry(strokes: number, par: number, updatedBy: string) {
  return {
    strokes,
    par,
    updatedAt: ts,
    updatedBy,
  }
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

function asItems(rounds: RoundDoc[]): IdRound[] {
  return rounds.map((data, i) => ({ id: `round-${i + 1}`, data }))
}

describe('computeCourseHighscores', () => {
  it('returns empty list for no rounds', () => {
    expect(computeCourseHighscores([], 'course-1', 9)).toEqual([])
  })

  it('keeps only the best (lowest strokes) entry per user', () => {
    const rounds = asItems([
      makeRound({
        participantIds: ['alice'],
        participantHoleScores: { alice: fullHoles('alice', [3, 4, 3]) },
      }),
      makeRound({
        participantIds: ['alice'],
        participantHoleScores: { alice: fullHoles('alice', [3, 3, 3]) },
      }),
    ])
    const result = computeCourseHighscores(rounds, 'course-1', 3)
    expect(result).toHaveLength(1)
    expect(result[0].uid).toBe('alice')
    expect(result[0].totalStrokes).toBe(9)
  })

  it('orders distinct users by ascending total strokes and returns top 3', () => {
    const rounds = asItems([
      makeRound({
        participantIds: ['alice'],
        participantHoleScores: { alice: fullHoles('alice', [3, 3, 4]) },
      }),
      makeRound({
        participantIds: ['bob'],
        participantHoleScores: { bob: fullHoles('bob', [3, 3, 3]) },
      }),
      makeRound({
        participantIds: ['carol'],
        participantHoleScores: { carol: fullHoles('carol', [4, 4, 4]) },
      }),
      makeRound({
        participantIds: ['dave'],
        participantHoleScores: { dave: fullHoles('dave', [5, 4, 4]) },
      }),
    ])
    const result = computeCourseHighscores(rounds, 'course-1', 3)
    expect(result.map((r) => r.uid)).toEqual(['bob', 'alice', 'carol'])
    expect(result[0].totalStrokes).toBe(9)
    expect(result[1].totalStrokes).toBe(10)
    expect(result[2].totalStrokes).toBe(12)
  })

  it('excludes rounds with missing holes', () => {
    const rounds = asItems([
      makeRound({
        participantIds: ['alice'],
        participantHoleScores: { alice: fullHoles('alice', [3, 3]) },
      }),
    ])
    expect(computeCourseHighscores(rounds, 'course-1', 3)).toEqual([])
  })

  it('excludes rounds for other courses', () => {
    const rounds = asItems([
      makeRound({
        courseId: 'course-2',
        participantIds: ['alice'],
        participantHoleScores: { alice: fullHoles('alice', [3, 3, 3]) },
      }),
    ])
    expect(computeCourseHighscores(rounds, 'course-1', 3)).toEqual([])
  })

  it('includes promoted-fresh rounds whose coursePromotion.targetCourseId matches', () => {
    const rounds = asItems([
      makeRound({
        courseId: 'fresh-sentinel',
        coursePromotion: { status: 'created', targetCourseId: 'course-1' },
        participantIds: ['alice'],
        participantHoleScores: { alice: fullHoles('alice', [3, 3, 3]) },
      }),
    ])
    const result = computeCourseHighscores(rounds, 'course-1', 3)
    expect(result.map((r) => r.uid)).toEqual(['alice'])
  })

  it('skips rounds without a completedAt', () => {
    const rounds = asItems([
      makeRound({
        completedAt: null,
        participantIds: ['alice'],
        participantHoleScores: { alice: fullHoles('alice', [3, 3, 3]) },
      }),
    ])
    expect(computeCourseHighscores(rounds, 'course-1', 3)).toEqual([])
  })

  it('breaks ties on lower delta, then earlier completedAt', () => {
    const rounds = asItems([
      makeRound({
        completedAt: tsAt(2_000),
        participantIds: ['alice'],
        participantHoleScores: { alice: fullHoles('alice', [3, 3, 3], 3) },
      }),
      makeRound({
        completedAt: tsAt(1_000),
        participantIds: ['bob'],
        participantHoleScores: { bob: fullHoles('bob', [3, 3, 3], 3) },
      }),
      makeRound({
        completedAt: tsAt(3_000),
        participantIds: ['carol'],
        participantHoleScores: { carol: fullHoles('carol', [3, 3, 3], 4) },
      }),
    ])
    const result = computeCourseHighscores(rounds, 'course-1', 3)
    expect(result.map((r) => r.uid)).toEqual(['carol', 'bob', 'alice'])
  })

  it('respects the limit option', () => {
    const rounds = asItems([
      makeRound({
        participantIds: ['alice'],
        participantHoleScores: { alice: fullHoles('alice', [3, 3, 3]) },
      }),
      makeRound({
        participantIds: ['bob'],
        participantHoleScores: { bob: fullHoles('bob', [4, 4, 4]) },
      }),
    ])
    expect(computeCourseHighscores(rounds, 'course-1', 3, { limit: 1 })).toHaveLength(1)
  })

  it('handles multiple participants in the same round', () => {
    const rounds = asItems([
      makeRound({
        participantIds: ['alice', 'bob'],
        participantHoleScores: {
          alice: fullHoles('alice', [3, 3, 3]),
          bob: fullHoles('bob', [4, 4, 4]),
        },
      }),
    ])
    const result = computeCourseHighscores(rounds, 'course-1', 3)
    expect(result.map((r) => r.uid)).toEqual(['alice', 'bob'])
  })
})

const threeHoleTemplate = [
  { number: 1, par: 3 },
  { number: 2, par: 3 },
  { number: 3, par: 3 },
]

describe('computeCourseOverviewStats', () => {
  it('counts distinct scorecards (one round shared by N players is still one)', () => {
    const rounds = asItems([
      makeRound({
        participantIds: ['alice', 'bob'],
        participantHoleScores: {
          alice: fullHoles('alice', [3, 3, 3]),
          bob: fullHoles('bob', [4, 4, 4]),
        },
      }),
      makeRound({
        participantIds: ['alice'],
        participantHoleScores: { alice: fullHoles('alice', [3, 3, 4]) },
      }),
    ])
    const result = computeCourseOverviewStats(rounds, 'course-1', threeHoleTemplate)
    expect(result.totalScorecards).toBe(2)
    expect(result.uniquePlayers).toBe(2)
  })

  it('sums total throws across every scored hole', () => {
    const rounds = asItems([
      makeRound({
        participantIds: ['alice', 'bob'],
        participantHoleScores: {
          alice: fullHoles('alice', [3, 3, 3]),
          bob: fullHoles('bob', [4, 4, 4]),
        },
      }),
    ])
    const result = computeCourseOverviewStats(rounds, 'course-1', threeHoleTemplate)
    expect(result.totalThrows).toBe(21)
  })

  it('averages net delta across full participant-rounds', () => {
    const rounds = asItems([
      makeRound({
        participantIds: ['alice'],
        participantHoleScores: { alice: fullHoles('alice', [3, 4, 3]) },
      }),
      makeRound({
        participantIds: ['bob'],
        participantHoleScores: { bob: fullHoles('bob', [5, 5, 5]) },
      }),
    ])
    const result = computeCourseOverviewStats(rounds, 'course-1', threeHoleTemplate)
    expect(result.averageNetDelta).toBeCloseTo((1 + 6) / 2, 5)
  })

  it('returns null averageNetDelta when there are no full participant-rounds', () => {
    const rounds = asItems([
      makeRound({
        participantIds: ['alice'],
        participantHoleScores: { alice: fullHoles('alice', [3, 3]) },
      }),
    ])
    const result = computeCourseOverviewStats(rounds, 'course-1', threeHoleTemplate)
    expect(result.averageNetDelta).toBeNull()
  })

  it('exposes best and average score per hole when data exists', () => {
    const rounds = asItems([
      makeRound({
        participantIds: ['alice', 'bob'],
        participantHoleScores: {
          alice: fullHoles('alice', [3, 4, 3]),
          bob: fullHoles('bob', [2, 5, 4]),
        },
      }),
      makeRound({
        participantIds: ['carol'],
        participantHoleScores: { carol: fullHoles('carol', [4, 3, 5]) },
      }),
    ])
    const result = computeCourseOverviewStats(rounds, 'course-1', threeHoleTemplate)
    const hole1 = result.holeStats.find((h) => h.number === 1)!
    expect(hole1.bestScore).toBe(2)
    expect(hole1.averageScore).toBeCloseTo((3 + 2 + 4) / 3, 5)
    expect(hole1.sampleCount).toBe(3)
    const hole2 = result.holeStats.find((h) => h.number === 2)!
    expect(hole2.bestScore).toBe(3)
    expect(hole2.averageScore).toBeCloseTo((4 + 5 + 3) / 3, 5)
  })

  it('reports null best/average for holes with no samples', () => {
    const result = computeCourseOverviewStats([], 'course-1', threeHoleTemplate)
    for (const hole of result.holeStats) {
      expect(hole.bestScore).toBeNull()
      expect(hole.averageScore).toBeNull()
      expect(hole.sampleCount).toBe(0)
    }
  })

  it('ignores rounds without completedAt and rounds on other courses', () => {
    const rounds = asItems([
      makeRound({
        completedAt: null,
        participantIds: ['alice'],
        participantHoleScores: { alice: fullHoles('alice', [3, 3, 3]) },
      }),
      makeRound({
        courseId: 'course-2',
        participantIds: ['carol'],
        participantHoleScores: { carol: fullHoles('carol', [3, 3, 3]) },
      }),
    ])
    const result = computeCourseOverviewStats(rounds, 'course-1', threeHoleTemplate)
    expect(result).toMatchObject({
      totalScorecards: 0,
      uniquePlayers: 0,
      totalThrows: 0,
      averageNetDelta: null,
    })
  })

  it('counts a promoted-fresh round once with its target course', () => {
    const rounds = asItems([
      makeRound({
        courseId: 'fresh-sentinel',
        coursePromotion: { status: 'created', targetCourseId: 'course-1' },
        participantIds: ['alice'],
        participantHoleScores: { alice: fullHoles('alice', [3, 3, 3]) },
      }),
    ])
    const result = computeCourseOverviewStats(rounds, 'course-1', threeHoleTemplate)
    expect(result.totalScorecards).toBe(1)
    expect(result.uniquePlayers).toBe(1)
    expect(result.totalThrows).toBe(9)
  })
})
