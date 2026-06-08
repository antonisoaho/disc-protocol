import { describe, expect, it } from 'vitest'
import { applyParticipantHoleScorePatches } from '@core/domain/participantHoleScorePatches'

describe('applyParticipantHoleScorePatches', () => {
  it('applies multiple participant updates without dropping earlier scores', () => {
    const result = applyParticipantHoleScorePatches(
      {
        u1: { '1': { strokes: 4, par: 3 } },
        u2: { '1': { strokes: 4, par: 3 } },
      },
      [
        { participantUid: 'u3', holeKey: '1', strokes: 5, par: 3 },
        { participantUid: 'u4', holeKey: '1', strokes: 5, par: 3 },
      ],
    )

    expect(result).toEqual({
      u1: { '1': { strokes: 4, par: 3 } },
      u2: { '1': { strokes: 4, par: 3 } },
      u3: { '1': { strokes: 5, par: 3 } },
      u4: { '1': { strokes: 5, par: 3 } },
    })
  })
})
