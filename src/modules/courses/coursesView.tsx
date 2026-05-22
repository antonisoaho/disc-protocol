import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@core/auth/useAuth'
import { translateUserError } from '@common/i18n/translateError'
import { subscribeCourses, type CourseWithId } from '@core/domain/courseData'

type Props = {
  favoriteCourseIds: string[]
  onToggleFavoriteCourse: (courseId: string, isFavorite: boolean) => Promise<void>
}

export function CoursePicker({ favoriteCourseIds, onToggleFavoriteCourse }: Props) {
  const { t } = useTranslation('common')
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const [courses, setCourses] = useState<CourseWithId[]>([])
  const [listError, setListError] = useState<string | null>(null)

  useEffect(() => {
    const unsub = subscribeCourses(
      (rows) => {
        setCourses(rows)
        setListError(null)
      },
      (e) => setListError(translateUserError(t, e.message)),
    )
    return () => unsub()
  }, [t])

  const favoriteCourseIdSet = useMemo(() => new Set(favoriteCourseIds), [favoriteCourseIds])

  return (
    <section className="course-picker" aria-label={t('courses.aria.chooseCourse')}>
      <div className="course-picker__toolbar">
        <h2 className="course-picker__heading">{t('courses.heading')}</h2>
        {isAdmin ? (
          <span className="course-picker__badge" title={t('courses.admin.title')}>
            {t('courses.admin.badge')}
          </span>
        ) : null}
      </div>

      {listError ? (
        <p className="course-picker__error" role="alert">
          {listError}
        </p>
      ) : null}

      {courses.length === 0 && !listError ? (
        <p className="course-picker__empty">{t('courses.empty.noCourses')}</p>
      ) : (
        <ul className="course-picker__list">
          {courses.map((c) => {
            const isFavorite = favoriteCourseIdSet.has(c.id)
            return (
              <li key={c.id} className="course-picker__item">
                <div className="course-picker__course-row">
                  <button
                    type="button"
                    className="course-picker__course-btn"
                    onClick={() => navigate(`/courses/${c.id}`)}
                  >
                    <span className="course-picker__course-name">{c.name}</span>
                    <span className="course-picker__course-meta">
                      {[c.city, c.organization, c.slug].filter(Boolean).join(' · ') ||
                        t('courses.courseCard.fallbackMeta')}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`course-picker__favorite-btn${isFavorite ? ' course-picker__favorite-btn--active' : ''}`}
                    onClick={() => void onToggleFavoriteCourse(c.id, !isFavorite)}
                    aria-pressed={isFavorite}
                    aria-label={
                      isFavorite
                        ? t('courses.favourites.removeAria', { courseName: c.name })
                        : t('courses.favourites.addAria', { courseName: c.name })
                    }
                    title={
                      isFavorite
                        ? t('courses.favourites.removeAria', { courseName: c.name })
                        : t('courses.favourites.addAria', { courseName: c.name })
                    }
                  >
                    {isFavorite ? '★' : '☆'}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
