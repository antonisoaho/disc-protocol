import { describe, expect, it } from 'vitest'
import {
  resolveHonorDisplayLabel,
  resolveHonorThrowerUid,
} from '@modules/scoring/domain/resolveHonorThrowerUid'
import type { ParticipantHoleScores } from '@core/domain/scorecardTable'

describe('resolveHonorThrowerUid', () => {
  it('returns sole leader on previous hole', () => {
    const s: ParticipantHoleScores = {
      a: { '1': { strokes: 3, par: 3 } },
      b: { '1': { strokes: 4, par: 3 } },
    }
    expect(resolveHonorThrowerUid(['a', 'b'], s, 2)).toBe('a')
  })

  it('breaks a tie on previous hole using the hole before among tied players', () => {
    const s: ParticipantHoleScores = {
      a: {
        '1': { strokes: 3, par: 3 },
        '2': { strokes: 4, par: 3 },
      },
      b: {
        '1': { strokes: 3, par: 3 },
        '2': { strokes: 5, par: 3 },
      },
    }
    expect(resolveHonorThrowerUid(['a', 'b'], s, 3)).toBe('a')
  })

  it('walks back among tied players until one clear leader', () => {
    const s: ParticipantHoleScores = {
      a: {
        '1': { strokes: 2, par: 3 },
        '2': { strokes: 3, par: 3 },
        '3': { strokes: 4, par: 3 },
      },
      b: {
        '1': { strokes: 3, par: 3 },
        '2': { strokes: 3, par: 3 },
        '3': { strokes: 4, par: 3 },
      },
    }
    // Hole 3: tie 4–4. Hole 2 among a,b: 3–3 tie. Hole 1 among a,b: 2 vs 3 → a.
    expect(resolveHonorThrowerUid(['a', 'b'], s, 4)).toBe('a')
  })

  it('uses roster order when ties never break by earlier holes', () => {
    const s: ParticipantHoleScores = {
      a: { '1': { strokes: 3, par: 3 }, '2': { strokes: 3, par: 3 } },
      b: { '1': { strokes: 3, par: 3 }, '2': { strokes: 3, par: 3 } },
    }
    expect(resolveHonorThrowerUid(['a', 'b'], s, 3)).toBe('a')
  })
})

describe('resolveHonorDisplayLabel', () => {
  it('returns player name for individual rounds', () => {
    const scores: ParticipantHoleScores = {
      a: { '1': { strokes: 3, par: 3 } },
      b: { '1': { strokes: 4, par: 3 } },
    }
    expect(
      resolveHonorDisplayLabel({
        participantIds: ['a', 'b'],
        scores,
        activeHoleNumber: 2,
        participantNames: { a: 'Alice', b: 'Bob' },
        isScramble: false,
      }),
    ).toBe('Alice')
  })

  it('returns team name for scramble rounds', () => {
    const scores: ParticipantHoleScores = {
      a: { '1': { strokes: 3, par: 3 } },
      b: { '1': { strokes: 3, par: 3 } },
      c: { '1': { strokes: 4, par: 3 } },
      d: { '1': { strokes: 4, par: 3 } },
    }
    expect(
      resolveHonorDisplayLabel({
        participantIds: ['a', 'b', 'c', 'd'],
        scores,
        activeHoleNumber: 2,
        participantNames: { a: 'Alice', b: 'Bob', c: 'Carol', d: 'Dave' },
        isScramble: true,
        teams: [
          { id: 'team:kings', name: 'The kings', participantIds: ['a', 'b'] },
          { id: 'team:bb', name: 'BB', participantIds: ['c', 'd'] },
        ],
      }),
    ).toBe('The kings')
  })
})
