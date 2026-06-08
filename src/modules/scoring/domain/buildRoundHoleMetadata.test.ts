import { describe, expect, it } from 'vitest'
import { buildRoundHoleMetadataByNumber } from '@modules/scoring/domain/buildRoundHoleMetadata'

describe('buildRoundHoleMetadataByNumber', () => {
  it('uses saved layout par and length for every hole', () => {
    expect(
      buildRoundHoleMetadataByNumber({
        holeCount: 3,
        courseSource: 'saved',
        layoutHoles: [
          { number: 1, par: 3, lengthMeters: 90 },
          { number: 2, par: 4, lengthMeters: 110 },
          { number: 3, par: 3, lengthMeters: 85 },
        ],
        scoresByParticipant: {
          a: { '1': { strokes: 3, par: 3 } },
        },
        participantIds: ['a'],
      }),
    ).toEqual({
      1: { par: 3, lengthMeters: 90 },
      2: { par: 4, lengthMeters: 110 },
      3: { par: 3, lengthMeters: 85 },
    })
  })

  it('falls back to score par when layout is missing', () => {
    expect(
      buildRoundHoleMetadataByNumber({
        holeCount: 2,
        courseSource: 'saved',
        scoresByParticipant: {
          a: { '1': { strokes: 3, par: 3 } },
        },
        participantIds: ['a'],
      }),
    ).toEqual({
      1: { par: 3, lengthMeters: null },
      2: { par: null, lengthMeters: null },
    })
  })

  it('uses fresh course draft metadata', () => {
    expect(
      buildRoundHoleMetadataByNumber({
        holeCount: 2,
        courseSource: 'fresh',
        courseDraftHoles: [
          { number: 1, par: 3, lengthMeters: 100 },
          { number: 2, par: 4, lengthMeters: 120 },
        ],
      }),
    ).toEqual({
      1: { par: 3, lengthMeters: 100 },
      2: { par: 4, lengthMeters: 120 },
    })
  })
})
