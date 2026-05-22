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

describe('computeCourseOverviewStats', () => {
  it('counts full-round entries and unique players for the matching course', () => {
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
    expect(computeCourseOverviewStats(rounds, 'course-1', 3)).toEqual({
      totalFullRounds: 3,
      uniquePlayers: 2,
    })
  })

  it('excludes partial rounds and other-course rounds', () => {
    const rounds = asItems([
      makeRound({
        participantIds: ['alice'],
        participantHoleScores: { alice: fullHoles('alice', [3, 3]) },
      }),
      makeRound({
        courseId: 'course-2',
        participantIds: ['carol'],
        participantHoleScores: { carol: fullHoles('carol', [3, 3, 3]) },
      }),
    ])
    expect(computeCourseOverviewStats(rounds, 'course-1', 3)).toEqual({
      totalFullRounds: 0,
      uniquePlayers: 0,
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
    expect(computeCourseOverviewStats(rounds, 'course-1', 3)).toEqual({
      totalFullRounds: 1,
      uniquePlayers: 1,
    })
  })

  it('ignores rounds without completedAt', () => {
    const rounds = asItems([
      makeRound({
        completedAt: null,
        participantIds: ['alice'],
        participantHoleScores: { alice: fullHoles('alice', [3, 3, 3]) },
      }),
    ])
    expect(computeCourseOverviewStats(rounds, 'course-1', 3)).toEqual({
      totalFullRounds: 0,
      uniquePlayers: 0,
    })
  })
})
