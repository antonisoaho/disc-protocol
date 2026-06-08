import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import type { CourseWithId } from '@core/domain/courseData'
import type { CourseMode } from '@modules/rounds/domain/startRoundWizard'

type NineOrEighteen = 9 | 18

type Props = {
  courseMode: CourseMode
  onCourseModeChange: (mode: CourseMode) => void
  courseSearchQuery: string
  onCourseSearchQueryChange: (value: string) => void
  filteredCourses: CourseWithId[]
  favoriteCourseIdSet: Set<string>
  selectedSavedCourseId: string | null
  onSelectedSavedCourseIdChange: (courseId: string) => void
  freshCourseName: string
  onFreshCourseNameChange: (value: string) => void
  freshCourseNameError: string | null
  freshCourseNameInputRef: RefObject<HTMLInputElement | null>
  onFreshCourseNameInvalid: (input: HTMLInputElement) => void
  freshHoleChoice: NineOrEighteen
  onFreshHoleChoiceChange: (holes: NineOrEighteen) => void
  busy: boolean
  courseLoadError: string | null
  noSavedCourses: boolean
}

const NON_WHITESPACE_PATTERN = '.*\\S.*'

export function StartRoundCourseStep({
  courseMode,
  onCourseModeChange,
  courseSearchQuery,
  onCourseSearchQueryChange,
  filteredCourses,
  favoriteCourseIdSet,
  selectedSavedCourseId,
  onSelectedSavedCourseIdChange,
  freshCourseName,
  onFreshCourseNameChange,
  freshCourseNameError,
  freshCourseNameInputRef,
  onFreshCourseNameInvalid,
  freshHoleChoice,
  onFreshHoleChoiceChange,
  busy,
  courseLoadError,
  noSavedCourses,
}: Props) {
  const { t } = useTranslation('common')

  return (
    <div className="scoring-panel__section">
      <div className="scoring-panel__tabs" role="tablist" aria-label={t('scoring.start.courseToPlay')}>
        <button
          type="button"
          role="tab"
          aria-selected={courseMode === 'saved'}
          className={`scoring-panel__tab${courseMode === 'saved' ? ' scoring-panel__tab--active' : ''}`}
          onClick={() => onCourseModeChange('saved')}
          disabled={busy || noSavedCourses}
        >
          {t('rounds.new.wizard.courseMode.saved')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={courseMode === 'quick'}
          className={`scoring-panel__tab${courseMode === 'quick' ? ' scoring-panel__tab--active' : ''}`}
          onClick={() => onCourseModeChange('quick')}
          disabled={busy}
        >
          {t('rounds.new.wizard.courseMode.quick')}
        </button>
      </div>

      {courseLoadError ? (
        <p className="scoring-panel__error" role="alert">
          {courseLoadError}
        </p>
      ) : null}

      {courseMode === 'saved' ? (
        <>
          {noSavedCourses ? (
            <p className="scoring-panel__muted">{t('scoring.start.noSavedCourses')}</p>
          ) : (
            <>
              <div className="scoring-panel__field scoring-panel__field--grow">
                <label className="scoring-panel__label" htmlFor="start-round-course-search">
                  {t('scoring.start.courseToPlay')}
                </label>
                <input
                  id="start-round-course-search"
                  className="scoring-panel__input"
                  value={courseSearchQuery}
                  onChange={(event) => onCourseSearchQueryChange(event.target.value)}
                  placeholder={t('rounds.new.wizard.courseSearchPlaceholder')}
                  autoComplete="off"
                  disabled={busy}
                />
              </div>
              <div
                className="start-round-wizard__course-list"
                role="radiogroup"
                aria-label={t('rounds.new.wizard.courseListAria')}
              >
                {filteredCourses.map((course) => {
                  const checked = selectedSavedCourseId === course.id
                  const isFavorite = favoriteCourseIdSet.has(course.id)
                  return (
                    <label key={course.id} className="start-round-wizard__course-option">
                      <input
                        type="radio"
                        name="start-round-saved-course"
                        value={course.id}
                        checked={checked}
                        disabled={busy}
                        onChange={() => onSelectedSavedCourseIdChange(course.id)}
                      />
                      <span className="start-round-wizard__course-option-name">{course.name}</span>
                      {isFavorite ? (
                        <span className="start-round-wizard__favorite-badge">
                          {t('rounds.new.wizard.favoriteBadge')}
                        </span>
                      ) : null}
                    </label>
                  )
                })}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <p className="scoring-panel__muted">{t('rounds.new.wizard.quickHint')}</p>
          <div className="scoring-panel__row">
            <div className="scoring-panel__field scoring-panel__field--grow field">
              <label className="scoring-panel__label field__label" htmlFor="start-fresh-course-name">
                {t('scoring.start.courseName')}
              </label>
              <input
                id="start-fresh-course-name"
                ref={freshCourseNameInputRef}
                className={`scoring-panel__input field__control${freshCourseNameError ? ' field__control--invalid' : ''}`}
                value={freshCourseName}
                onChange={(event) => onFreshCourseNameChange(event.target.value)}
                onInvalid={(event) => {
                  event.preventDefault()
                  onFreshCourseNameInvalid(event.currentTarget)
                }}
                placeholder={t('scoring.start.courseNamePlaceholder')}
                autoComplete="off"
                required
                pattern={NON_WHITESPACE_PATTERN}
                aria-invalid={freshCourseNameError ? 'true' : 'false'}
                aria-describedby={freshCourseNameError ? 'start-fresh-course-name-error' : undefined}
                disabled={busy}
              />
              {freshCourseNameError ? (
                <p id="start-fresh-course-name-error" className="field__error" role="alert">
                  {freshCourseNameError}
                </p>
              ) : null}
            </div>
            <fieldset className="scoring-panel__field field">
              <legend className="scoring-panel__label field__label">{t('scoring.start.roundLength')}</legend>
              <div className="scoring-panel__row scoring-panel__row--compact" role="group">
                <label className="scoring-panel__participant-option">
                  <input
                    type="radio"
                    name="start-fresh-hole-choice"
                    checked={freshHoleChoice === 9}
                    disabled={busy}
                    onChange={() => onFreshHoleChoiceChange(9)}
                  />
                  <span>{t('scoring.start.holes9')}</span>
                </label>
                <label className="scoring-panel__participant-option">
                  <input
                    type="radio"
                    name="start-fresh-hole-choice"
                    checked={freshHoleChoice === 18}
                    disabled={busy}
                    onChange={() => onFreshHoleChoiceChange(18)}
                  />
                  <span>{t('scoring.start.holes18')}</span>
                </label>
              </div>
            </fieldset>
          </div>
        </>
      )}
    </div>
  )
}
