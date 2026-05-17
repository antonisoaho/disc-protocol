import { describe, expect, it } from 'vitest'
import type { RoundDoc } from '@core/domain/round'
import {
  computeHeadToHeadSummary,
  computeParticipantParSummary,
  listParticipantPlayedCourses,
  listParticipantRoundDeltasChronological,
} from '@core/domain/roundAnalytics'

const ts = {} as RoundDoc['startedAt']

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

describe('computeParticipantParSummary', () => {
  it('aggregates completed rounds and ignores unscored or in-progress rounds', () => {
    const rounds: RoundDoc[] = [
      makeRound({
        participantIds: ['me', 'friend'],
        participantHoleScores: {
          me: {
            '1': scoreEntry(3, 3, 'me'),
            '2': scoreEntry(4, 3, 'me'),
          },
          friend: {
            '1': scoreEntry(4, 3, 'friend'),
            '2': scoreEntry(4, 3, 'friend'),
          },
        },
      }),
      makeRound({
        participantIds: ['me', 'friend'],
        // Legacy shape: infer ownership from `updatedBy`.
        holeScores: {
          '1': scoreEntry(4, 3, 'me'),
        },
      }),
      makeRound({
        participantIds: ['me', 'friend'],
        participantHoleScores: {
          friend: {
            '1': scoreEntry(3, 3, 'friend'),
          },
        },
      }),
      makeRound({
        completedAt: null,
        participantIds: ['me', 'friend'],
        participantHoleScores: {
          me: {
            '1': scoreEntry(2, 3, 'me'),
          },
        },
      }),
    ]

    expect(computeParticipantParSummary(rounds, 'me')).toEqual({
      completedRounds: 3,
      scoredRounds: 2,
      scoredHoles: 3,
      totalStrokes: 11,
      totalPar: 9,
      totalDelta: 2,
    })
  })
})

describe('computeHeadToHeadSummary', () => {
  it('computes win/loss/tie over shared completed rounds with strict comparison criteria', () => {
    const rounds: RoundDoc[] = [
      makeRound({
        participantIds: ['me', 'friend'],
        participantHoleScores: {
          me: {
            '1': scoreEntry(2, 3, 'me'),
            '2': scoreEntry(3, 3, 'me'),
          },
          friend: {
            '1': scoreEntry(3, 3, 'friend'),
            '2': scoreEntry(4, 3, 'friend'),
          },
        },
      }),
      makeRound({
        participantIds: ['me', 'friend'],
        participantHoleScores: {
          me: {
            '1': scoreEntry(4, 3, 'me'),
            '2': scoreEntry(4, 3, 'me'),
          },
          friend: {
            '1': scoreEntry(3, 3, 'friend'),
            '2': scoreEntry(3, 3, 'friend'),
          },
        },
      }),
      makeRound({
        participantIds: ['me', 'friend'],
        participantHoleScores: {
          me: {
            '1': scoreEntry(3, 3, 'me'),
            '2': scoreEntry(3, 3, 'me'),
          },
          friend: {
            '1': scoreEntry(3, 3, 'friend'),
            '2': scoreEntry(3, 3, 'friend'),
          },
        },
      }),
      makeRound({
        participantIds: ['me', 'friend'],
        // Mismatched scored hole counts => skip from comparison.
        participantHoleScores: {
          me: {
            '1': scoreEntry(3, 3, 'me'),
          },
          friend: {
            '1': scoreEntry(3, 3, 'friend'),
            '2': scoreEntry(3, 3, 'friend'),
          },
        },
      }),
      makeRound({
        completedAt: null,
        participantIds: ['me', 'friend'],
        participantHoleScores: {
          me: {
            '1': scoreEntry(2, 3, 'me'),
          },
          friend: {
            '1': scoreEntry(3, 3, 'friend'),
          },
        },
      }),
    ]

    expect(computeHeadToHeadSummary(rounds, 'me', 'friend')).toEqual({
      opponentUid: 'friend',
      sharedCompletedRounds: 4,
      comparedRounds: 3,
      skippedRounds: 1,
      wins: 1,
      losses: 1,
      ties: 1,
    })
  })
})

describe('listParticipantRoundDeltasChronological', () => {
  it('returns scored completed rounds sorted by startedAt ascending', () => {
    const mk = (ms: number, deltaStrokes: number, id: string): { id: string; data: RoundDoc } => ({
      id,
      data: makeRound({
        startedAt: { toMillis: () => ms } as RoundDoc['startedAt'],
        completedAt: ts,
        participantHoleScores: {
          me: {
            '1': scoreEntry(3 + deltaStrokes, 3, 'me'),
          },
        },
      }),
    })
    const items = [mk(300, 2, 'c'), mk(100, -1, 'a'), mk(200, 0, 'b')]
    expect(listParticipantRoundDeltasChronological(items, 'me')).toEqual([
      { roundId: 'a', dateMs: 100, totalDelta: -1, scoredHoles: 1 },
      { roundId: 'b', dateMs: 200, totalDelta: 0, scoredHoles: 1 },
      { roundId: 'c', dateMs: 300, totalDelta: 2, scoredHoles: 1 },
    ])
  })

  it('filters by courseKey when provided', () => {
    const scored = (uid: string) => ({
      [uid]: { '1': scoreEntry(3, 3, uid) },
    })
    const items = [
      {
        id: 'a',
        data: makeRound({
          startedAt: { toMillis: () => 100 } as RoundDoc['startedAt'],
          courseId: 'course-1',
          courseName: 'Maple Hill',
          participantHoleScores: scored('me'),
        }),
      },
      {
        id: 'b',
        data: makeRound({
          startedAt: { toMillis: () => 200 } as RoundDoc['startedAt'],
          courseId: 'course-2',
          courseName: 'De Laveaga',
          participantHoleScores: scored('me'),
        }),
      },
    ]

    expect(
      listParticipantRoundDeltasChronological(items, 'me', { courseKey: 'catalog:course-1' }),
    ).toEqual([{ roundId: 'a', dateMs: 100, totalDelta: 0, scoredHoles: 1 }])
  })

  it('returns empty when courseKey matches no rounds', () => {
    const items = [
      {
        id: 'a',
        data: makeRound({
          courseId: 'course-1',
          startedAt: { toMillis: () => 100 } as RoundDoc['startedAt'],
          participantHoleScores: { me: { '1': scoreEntry(3, 3, 'me') } },
        }),
      },
    ]
    expect(
      listParticipantRoundDeltasChronological(items, 'me', { courseKey: 'catalog:other' }),
    ).toEqual([])
  })
})

describe('listParticipantPlayedCourses', () => {
  it('returns an empty list when there are no rounds', () => {
    expect(listParticipantPlayedCourses([], 'me')).toEqual([])
  })

  it('only includes courses with completed, scored rounds for the participant', () => {
    const items = [
      {
        id: 'incomplete',
        data: makeRound({
          completedAt: null,
          courseId: 'course-skip',
          courseName: 'Skip me',
          participantHoleScores: { me: { '1': scoreEntry(3, 3, 'me') } },
        }),
      },
      {
        id: 'no-score',
        data: makeRound({
          courseId: 'course-empty',
          courseName: 'No score',
          participantHoleScores: {},
        }),
      },
      {
        id: 'friend-only',
        data: makeRound({
          courseId: 'course-friend',
          courseName: 'Friend only',
          participantIds: ['me', 'friend'],
          participantHoleScores: { friend: { '1': scoreEntry(3, 3, 'friend') } },
        }),
      },
      {
        id: 'good',
        data: makeRound({
          courseId: 'course-good',
          courseName: 'Good course',
          participantHoleScores: { me: { '1': scoreEntry(3, 3, 'me') } },
        }),
      },
    ]
    expect(listParticipantPlayedCourses(items, 'me')).toEqual([
      { key: 'catalog:course-good', label: 'Good course', source: 'catalog' },
    ])
  })

  it('groups catalog rounds by courseId and falls back to courseId when name is missing', () => {
    const items = [
      {
        id: 'a',
        data: makeRound({
          courseId: 'course-1',
          courseName: 'Maple Hill',
          participantHoleScores: { me: { '1': scoreEntry(3, 3, 'me') } },
        }),
      },
      {
        id: 'b',
        data: makeRound({
          courseId: 'course-1',
          courseName: 'Maple Hill',
          participantHoleScores: { me: { '1': scoreEntry(4, 3, 'me') } },
        }),
      },
      {
        id: 'c',
        data: makeRound({
          courseId: 'course-2',
          courseName: null,
          participantHoleScores: { me: { '1': scoreEntry(3, 3, 'me') } },
        }),
      },
    ]
    expect(listParticipantPlayedCourses(items, 'me')).toEqual([
      { key: 'catalog:course-2', label: 'course-2', source: 'catalog' },
      { key: 'catalog:course-1', label: 'Maple Hill', source: 'catalog' },
    ])
  })

  it('groups fresh rounds by normalized draft name', () => {
    const items = [
      {
        id: 'a',
        data: makeRound({
          courseId: 'round-a',
          courseSource: 'fresh',
          courseDraft: { name: '  Backyard Loop  ', holes: [] },
          participantHoleScores: { me: { '1': scoreEntry(3, 3, 'me') } },
        }),
      },
      {
        id: 'b',
        data: makeRound({
          courseId: 'round-b',
          courseSource: 'fresh',
          courseDraft: { name: 'backyard loop', holes: [] },
          participantHoleScores: { me: { '1': scoreEntry(4, 3, 'me') } },
        }),
      },
      {
        id: 'c',
        data: makeRound({
          courseId: 'round-c',
          courseSource: 'fresh',
          courseDraft: { name: 'Riverside', holes: [] },
          participantHoleScores: { me: { '1': scoreEntry(3, 3, 'me') } },
        }),
      },
    ]
    expect(listParticipantPlayedCourses(items, 'me')).toEqual([
      { key: 'fresh:backyard loop', label: 'Backyard Loop', source: 'fresh' },
      { key: 'fresh:riverside', label: 'Riverside', source: 'fresh' },
    ])
  })

  it('folds promoted-fresh rounds into the catalog course group', () => {
    const items = [
      {
        id: 'a',
        data: makeRound({
          courseId: 'round-a',
          courseSource: 'fresh',
          courseDraft: { name: 'Promoted Park', holes: [] },
          coursePromotion: { status: 'created', targetCourseId: 'course-promoted' },
          participantHoleScores: { me: { '1': scoreEntry(3, 3, 'me') } },
        }),
      },
      {
        id: 'b',
        data: makeRound({
          courseId: 'course-promoted',
          courseName: 'Promoted Park',
          participantHoleScores: { me: { '1': scoreEntry(4, 3, 'me') } },
        }),
      },
    ]
    expect(listParticipantPlayedCourses(items, 'me')).toEqual([
      { key: 'catalog:course-promoted', label: 'Promoted Park', source: 'catalog' },
    ])
  })

  it('sorts results alphabetically by label, case-insensitive', () => {
    const items = [
      {
        id: 'a',
        data: makeRound({
          courseId: 'course-a',
          courseName: 'Zen Gardens',
          participantHoleScores: { me: { '1': scoreEntry(3, 3, 'me') } },
        }),
      },
      {
        id: 'b',
        data: makeRound({
          courseId: 'course-b',
          courseName: 'aardvark Falls',
          participantHoleScores: { me: { '1': scoreEntry(3, 3, 'me') } },
        }),
      },
      {
        id: 'c',
        data: makeRound({
          courseId: 'course-c',
          courseName: 'Maple Hill',
          participantHoleScores: { me: { '1': scoreEntry(3, 3, 'me') } },
        }),
      },
    ]
    const labels = listParticipantPlayedCourses(items, 'me').map((c) => c.label)
    expect(labels).toEqual(['aardvark Falls', 'Maple Hill', 'Zen Gardens'])
  })
})
