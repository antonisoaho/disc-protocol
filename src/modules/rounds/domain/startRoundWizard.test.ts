import { describe, expect, it } from 'vitest'
import {
  resolveInitialCourseMode,
  resolveInitialSavedCourseId,
  validateCourseStep,
} from '@modules/rounds/domain/startRoundWizard'

describe('validateCourseStep', () => {
  it('requires a saved course id in saved mode', () => {
    expect(
      validateCourseStep({ courseMode: 'saved', selectedSavedCourseId: 'c1', freshCourseName: '' }),
    ).toBe(true)
    expect(
      validateCourseStep({ courseMode: 'saved', selectedSavedCourseId: null, freshCourseName: '' }),
    ).toBe(false)
  })

  it('requires a non-empty fresh course name in quick mode', () => {
    expect(
      validateCourseStep({ courseMode: 'quick', selectedSavedCourseId: null, freshCourseName: 'Park' }),
    ).toBe(true)
    expect(
      validateCourseStep({ courseMode: 'quick', selectedSavedCourseId: null, freshCourseName: '   ' }),
    ).toBe(false)
  })
})

describe('resolveInitialCourseMode', () => {
  it('defaults to quick when no saved courses exist', () => {
    expect(resolveInitialCourseMode({ availableCourseIds: [], favoriteCourseIds: ['f1'] })).toBe('quick')
  })

  it('defaults to saved when courses exist', () => {
    expect(resolveInitialCourseMode({ availableCourseIds: ['c1'], favoriteCourseIds: [] })).toBe('saved')
  })
})

describe('resolveInitialSavedCourseId', () => {
  it('picks first favorite that exists in sorted list', () => {
    expect(
      resolveInitialSavedCourseId({ sortedCourseIds: ['c1', 'c2', 'c3'], favoriteCourseIds: ['c3', 'c1'] }),
    ).toBe('c3')
  })

  it('falls back to first sorted course when no favorite matches', () => {
    expect(resolveInitialSavedCourseId({ sortedCourseIds: ['c1', 'c2'], favoriteCourseIds: ['x'] })).toBe('c1')
  })
})
