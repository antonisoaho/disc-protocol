export type WizardStep = 'course' | 'players' | 'review'

export type CourseMode = 'saved' | 'quick'

export function validateCourseStep(params: {
  courseMode: CourseMode
  selectedSavedCourseId: string | null
  freshCourseName: string
}): boolean {
  if (params.courseMode === 'saved') {
    return params.selectedSavedCourseId !== null && params.selectedSavedCourseId.trim().length > 0
  }
  return params.freshCourseName.trim().length > 0
}

export function resolveInitialCourseMode(params: {
  availableCourseIds: string[]
  favoriteCourseIds: string[]
}): CourseMode {
  if (params.availableCourseIds.length === 0) {
    return 'quick'
  }
  const favoriteMatch = params.favoriteCourseIds.find((id) => params.availableCourseIds.includes(id))
  if (favoriteMatch) {
    return 'saved'
  }
  return 'saved'
}

export function resolveInitialSavedCourseId(params: {
  sortedCourseIds: string[]
  favoriteCourseIds: string[]
}): string | null {
  if (params.sortedCourseIds.length === 0) {
    return null
  }
  const favoriteMatch = params.favoriteCourseIds.find((id) => params.sortedCourseIds.includes(id))
  return favoriteMatch ?? params.sortedCourseIds[0] ?? null
}
