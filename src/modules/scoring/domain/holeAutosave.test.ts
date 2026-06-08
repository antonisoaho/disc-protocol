import { describe, expect, it } from 'vitest'
import {
  clampHoleNumber,
  mergeAutosavePayload,
  stepHoleNumber,
} from '@modules/scoring/domain/holeAutosave'

describe('clampHoleNumber', () => {
  it('keeps hole number within [1..holeCount]', () => {
    expect(clampHoleNumber(0, 18)).toBe(1)
    expect(clampHoleNumber(7, 18)).toBe(7)
    expect(clampHoleNumber(25, 18)).toBe(18)
  })
})

describe('stepHoleNumber', () => {
  it('applies previous/next movement and respects bounds', () => {
    expect(stepHoleNumber(1, -1, 9)).toBe(1)
    expect(stepHoleNumber(3, 1, 9)).toBe(4)
    expect(stepHoleNumber(9, 1, 9)).toBe(9)
  })
})

describe('mergeAutosavePayload', () => {
  it('merges draft data into metadata and score updates', () => {
    const payload = mergeAutosavePayload({
      courseSource: 'fresh',
      participantIds: ['u-1', 'u-2'],
      draft: {
        parInput: '4',
        lengthInput: '101',
        scoreInputs: {
          'u-1': '3',
          'u-2': '',
        },
      },
      persisted: {
        par: 3,
        lengthMeters: 90,
        participantScores: {
          'u-1': { strokes: 4, par: 3 },
          'u-2': undefined,
        },
      },
    })

    expect(payload.validationError).toBeNull()
    expect(payload.metadata).toEqual({ par: '4', lengthMeters: '101' })
    expect(payload.participantScoreUpdates).toEqual([
      {
        participantUid: 'u-1',
        strokes: 3,
        par: 4,
      },
    ])
    expect(payload.hasMeaningfulChange).toBe(true)
    expect(payload.savedParSync).toBeNull()
    expect(payload.savedLengthSync).toBeNull()
  })

  it('returns no-op payload when nothing changed', () => {
    const payload = mergeAutosavePayload({
      courseSource: 'saved',
      participantIds: ['u-1'],
      draft: {
        parInput: '3',
        lengthInput: '',
        scoreInputs: {
          'u-1': '3',
        },
      },
      persisted: {
        par: 3,
        lengthMeters: null,
        participantScores: {
          'u-1': { strokes: 3, par: 3 },
        },
      },
    })

    expect(payload).toEqual({
      metadata: null,
      participantScoreUpdates: [],
      hasMeaningfulChange: false,
      validationError: null,
      savedParSync: null,
      savedLengthSync: null,
    })
  })

  it('emits savedParSync when admin adjusts par only on a saved-layout round', () => {
    const payload = mergeAutosavePayload({
      courseSource: 'saved',
      participantIds: ['u-1', 'u-2'],
      allowSavedMetadataAdjust: true,
      draft: {
        parInput: '4',
        lengthInput: '',
        scoreInputs: {
          'u-1': '',
          'u-2': '',
        },
      },
      persisted: {
        par: 3,
        lengthMeters: null,
        participantScores: {
          'u-1': { strokes: 3, par: 3 },
          'u-2': { strokes: 4, par: 3 },
        },
      },
    })

    expect(payload.validationError).toBeNull()
    expect(payload.participantScoreUpdates).toEqual([])
    expect(payload.savedParSync).toEqual({ par: 4 })
    expect(payload.savedLengthSync).toBeNull()
    expect(payload.hasMeaningfulChange).toBe(true)
  })

  it('skips savedParSync on a saved-layout round when allowSavedMetadataAdjust is false', () => {
    const payload = mergeAutosavePayload({
      courseSource: 'saved',
      participantIds: ['u-1', 'u-2'],
      allowSavedMetadataAdjust: false,
      draft: {
        parInput: '4',
        lengthInput: '',
        scoreInputs: {
          'u-1': '',
          'u-2': '',
        },
      },
      persisted: {
        par: 3,
        lengthMeters: null,
        participantScores: {
          'u-1': { strokes: 3, par: 3 },
          'u-2': { strokes: 4, par: 3 },
        },
      },
    })

    expect(payload.savedParSync).toBeNull()
    expect(payload.savedLengthSync).toBeNull()
    expect(payload.hasMeaningfulChange).toBe(false)
  })

  it('emits savedLengthSync when admin adjusts length on a saved-layout round', () => {
    const payload = mergeAutosavePayload({
      courseSource: 'saved',
      participantIds: ['u-1'],
      allowSavedMetadataAdjust: true,
      draft: {
        parInput: '3',
        lengthInput: '120',
        scoreInputs: {
          'u-1': '',
        },
      },
      persisted: {
        par: 3,
        lengthMeters: 90,
        participantScores: {
          'u-1': { strokes: 3, par: 3 },
        },
      },
    })

    expect(payload.validationError).toBeNull()
    expect(payload.savedParSync).toBeNull()
    expect(payload.savedLengthSync).toEqual({ lengthMeters: 120 })
    expect(payload.hasMeaningfulChange).toBe(true)
  })

  it('emits savedLengthSync with null when admin clears length on a saved-layout round', () => {
    const payload = mergeAutosavePayload({
      courseSource: 'saved',
      participantIds: ['u-1'],
      allowSavedMetadataAdjust: true,
      draft: {
        parInput: '3',
        lengthInput: '',
        scoreInputs: {
          'u-1': '',
        },
      },
      persisted: {
        par: 3,
        lengthMeters: 90,
        participantScores: {
          'u-1': { strokes: 3, par: 3 },
        },
      },
    })

    expect(payload.savedLengthSync).toEqual({ lengthMeters: null })
    expect(payload.hasMeaningfulChange).toBe(true)
  })

  it('persists only scoreParticipantIds when set (scramble team score)', () => {
    const payload = mergeAutosavePayload({
      courseSource: 'saved',
      participantIds: ['u-1', 'u-2'],
      scoreParticipantIds: ['u-1'],
      draft: {
        parInput: '3',
        lengthInput: '',
        scoreInputs: {
          'u-1': '4',
          'u-2': '4',
        },
      },
      persisted: {
        par: 3,
        lengthMeters: null,
        participantScores: {},
      },
    })

    expect(payload.participantScoreUpdates).toEqual([
      { participantUid: 'u-1', strokes: 4, par: 3 },
    ])
    expect(payload.hasMeaningfulChange).toBe(true)
  })

  it('skips savedLengthSync when allowSavedMetadataAdjust is false', () => {
    const payload = mergeAutosavePayload({
      courseSource: 'saved',
      participantIds: ['u-1'],
      allowSavedMetadataAdjust: false,
      draft: {
        parInput: '3',
        lengthInput: '120',
        scoreInputs: {
          'u-1': '',
        },
      },
      persisted: {
        par: 3,
        lengthMeters: 90,
        participantScores: {
          'u-1': { strokes: 3, par: 3 },
        },
      },
    })

    expect(payload.savedLengthSync).toBeNull()
    expect(payload.hasMeaningfulChange).toBe(false)
  })
})
