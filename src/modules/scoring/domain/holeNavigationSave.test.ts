import { describe, expect, it } from 'vitest'
import {
  buildLeaveHolePersistRequest,
  resolveBackgroundHoleSaveOnNavigate,
} from '@modules/scoring/domain/holeNavigationSave'

describe('buildLeaveHolePersistRequest', () => {
  const persisted = {
    par: 3,
    lengthMeters: 90,
    participantScores: { u1: { strokes: 3, par: 3 } },
  }

  it('returns a snapshot when draft exists even if it matches persisted scores', () => {
    const draft = { parInput: '3', lengthInput: '90', scoreInputs: { u1: '3' } }
    expect(
      buildLeaveHolePersistRequest({
        activeHoleNumber: 2,
        draft,
        persisted,
      }),
    ).toEqual({
      holeNumber: 2,
      draft,
      persisted,
    })
  })

  it('returns null when draft or persisted is missing', () => {
    expect(
      buildLeaveHolePersistRequest({
        activeHoleNumber: 2,
        draft: null,
        persisted,
      }),
    ).toBeNull()
  })
})

describe('resolveBackgroundHoleSaveOnNavigate', () => {
  const persisted = {
    par: 3,
    lengthMeters: 90,
    participantScores: { u1: { strokes: 3, par: 3 } },
  }

  it('returns no background save when navigating to the same hole', () => {
    const result = resolveBackgroundHoleSaveOnNavigate({
      activeHoleNumber: 2,
      targetHoleNumber: 2,
      holeCount: 18,
      draft: { parInput: '3', lengthInput: '90', scoreInputs: { u1: '4' } },
      persisted,
      courseSource: 'saved',
      participantIds: ['u1'],
    })

    expect(result.nextHoleNumber).toBe(2)
    expect(result.backgroundSave).toBeNull()
  })

  it('queues a background save when leaving a hole with unsaved edits', () => {
    const draft = { parInput: '3', lengthInput: '90', scoreInputs: { u1: '4' } }
    const result = resolveBackgroundHoleSaveOnNavigate({
      activeHoleNumber: 2,
      targetHoleNumber: 3,
      holeCount: 18,
      draft,
      persisted,
      courseSource: 'saved',
      participantIds: ['u1'],
    })

    expect(result.nextHoleNumber).toBe(3)
    expect(result.backgroundSave).toEqual({
      holeNumber: 2,
      draft,
      persisted,
    })
  })

  it('navigates without background save when the draft matches persisted data', () => {
    const result = resolveBackgroundHoleSaveOnNavigate({
      activeHoleNumber: 2,
      targetHoleNumber: 3,
      holeCount: 18,
      draft: { parInput: '3', lengthInput: '90', scoreInputs: { u1: '3' } },
      persisted,
      courseSource: 'saved',
      participantIds: ['u1'],
    })

    expect(result.nextHoleNumber).toBe(3)
    expect(result.backgroundSave).toBeNull()
  })
})
