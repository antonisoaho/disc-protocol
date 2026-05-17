import { describe, expect, it } from 'vitest'
import type { RoundDoc } from '@core/domain/round'
import { resolveRoundAccess } from '@modules/scoring/domain/roundAccess'

const ts = {} as RoundDoc['startedAt']

function makeRound(overrides: Partial<RoundDoc>): RoundDoc {
  return {
    ownerId: 'host',
    participantIds: ['host'],
    courseId: 'c',
    templateId: 't',
    visibility: 'public',
    startedAt: ts,
    completedAt: ts,
    holeScores: {},
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  }
}

describe('resolveRoundAccess', () => {
  it('returns edit for participants regardless of visibility or completion', () => {
    expect(resolveRoundAccess(makeRound({ participantIds: ['me'] }), 'me')).toBe('edit')
    expect(
      resolveRoundAccess(
        makeRound({ participantIds: ['me'], visibility: 'private', completedAt: null }),
        'me',
      ),
    ).toBe('edit')
  })

  it('returns read for non-participants on a completed public round', () => {
    expect(
      resolveRoundAccess(makeRound({ participantIds: ['friend'], visibility: 'public' }), 'me'),
    ).toBe('read')
  })

  it('returns read for non-participants on a completed unlisted round', () => {
    expect(
      resolveRoundAccess(makeRound({ participantIds: ['friend'], visibility: 'unlisted' }), 'me'),
    ).toBe('read')
  })

  it('returns denied for non-participants on a completed private round', () => {
    expect(
      resolveRoundAccess(makeRound({ participantIds: ['friend'], visibility: 'private' }), 'me'),
    ).toBe('denied')
  })

  it('returns denied for non-participants on an in-progress round (any visibility)', () => {
    for (const visibility of ['public', 'unlisted', 'private'] as const) {
      expect(
        resolveRoundAccess(
          makeRound({ participantIds: ['friend'], visibility, completedAt: null }),
          'me',
        ),
      ).toBe('denied')
    }
  })
})
