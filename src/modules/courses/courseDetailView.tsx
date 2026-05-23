import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@core/auth/useAuth'
import { translateUserError } from '@common/i18n/translateError'
import {
  deleteCourseWithTemplates,
  pickCanonicalCourseTemplate,
  subscribeCourses,
  subscribeTemplates,
  updateCourseDetails,
  type CourseTemplateWithId,
  type CourseWithId,
} from '@core/domain/courseData'
import { normalizeCourseCity, validateCourseName } from '@core/domain/templateDraft'
import {
  computeCourseHighscores,
  computeCourseOverviewStats,
} from '@core/domain/courseHighscores'
import { subscribeCourseRounds, type RoundListItem } from '@core/domain/rounds'
import { subscribeUserDirectory, type UserDirectoryEntry } from '@core/users/userDirectory'
import { CoursePickerTemplatePanel } from '@modules/courses/components/CoursePickerTemplatePanel'
import { CourseHighscoresPanel } from '@modules/courses/components/CourseHighscoresPanel'
import { CourseTemplateReadOnly } from '@modules/courses/components/CourseTemplateReadOnly'

export function CourseDetailView() {
  const { courseId } = useParams<{ courseId: string }>()

  if (!courseId) {
    return <Navigate to="/courses" replace />
  }

  return <CourseDetail courseId={courseId} />
}

type DetailProps = {
  courseId: string
}

function CourseDetail({ courseId }: DetailProps) {
  const { t } = useTranslation('common')
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()

  const [courses, setCourses] = useState<CourseWithId[]>([])
  const [coursesLoaded, setCoursesLoaded] = useState(false)
  const [courseError, setCourseError] = useState<string | null>(null)
  const [templatesState, setTemplatesState] = useState<{
    courseId: string
    rows: CourseTemplateWithId[]
    error: string | null
  }>({ courseId, rows: [], error: null })

  const [renameDraft, setRenameDraft] = useState<{ name: string; city: string } | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [renameError, setRenameError] = useState<string | null>(null)
  const [deletingCourse, setDeletingCourse] = useState(false)
  const [deleteCourseError, setDeleteCourseError] = useState<string | null>(null)

  const [roundsState, setRoundsState] = useState<{
    courseId: string
    rounds: RoundListItem[]
    error: string | null
  }>({ courseId, rounds: [], error: null })
  const [directory, setDirectory] = useState<UserDirectoryEntry[]>([])

  useEffect(() => {
    const unsub = subscribeCourseRounds(
      courseId,
      (items) => setRoundsState({ courseId, rounds: items, error: null }),
      (e) =>
        setRoundsState({ courseId, rounds: [], error: translateUserError(t, e.message) }),
    )
    return () => unsub()
  }, [courseId, t])

  useEffect(() => {
    const unsub = subscribeUserDirectory(
      (entries) => setDirectory(entries),
      () => {},
    )
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = subscribeCourses(
      (rows) => {
        setCourses(rows)
        setCoursesLoaded(true)
        setCourseError(null)
      },
      (e) => {
        setCoursesLoaded(true)
        setCourseError(translateUserError(t, e.message))
      },
    )
    return () => unsub()
  }, [t])

  useEffect(() => {
    const unsub = subscribeTemplates(
      courseId,
      (rows) => setTemplatesState({ courseId, rows, error: null }),
      (e) =>
        setTemplatesState({ courseId, rows: [], error: translateUserError(t, e.message) }),
    )
    return () => unsub()
  }, [courseId, t])

  const templates = useMemo(
    () => (templatesState.courseId === courseId ? templatesState.rows : []),
    [templatesState, courseId],
  )
  const templatesError = templatesState.courseId === courseId ? templatesState.error : null

  const course = useMemo(
    () => courses.find((c) => c.id === courseId) ?? null,
    [courses, courseId],
  )
  const resolvedTemplate = useMemo(() => pickCanonicalCourseTemplate(templates), [templates])
  const canEditActiveTemplate = useMemo(() => {
    if (!user || !resolvedTemplate) return false
    return isAdmin || resolvedTemplate.createdBy === user.uid
  }, [isAdmin, resolvedTemplate, user])

  const renameName = renameDraft?.name ?? course?.name ?? ''
  const renameCity = renameDraft?.city ?? course?.city ?? ''

  const rounds = useMemo(
    () => (roundsState.courseId === courseId ? roundsState.rounds : []),
    [roundsState, courseId],
  )
  const roundsError = roundsState.courseId === courseId ? roundsState.error : null

  const overviewStats = useMemo(
    () => computeCourseOverviewStats(rounds, courseId, resolvedTemplate?.holes ?? []),
    [rounds, courseId, resolvedTemplate],
  )
  const highscoreEntries = useMemo(
    () => computeCourseHighscores(rounds, courseId, resolvedTemplate?.holes.length ?? 0),
    [rounds, courseId, resolvedTemplate],
  )
  const displayNameByUid = useMemo(() => {
    const map = new Map<string, string>()
    for (const entry of directory) {
      map.set(entry.uid, entry.displayName)
    }
    return map
  }, [directory])
  const resolveDisplayName = useMemo(
    () => (uid: string) => {
      const name = displayNameByUid.get(uid)
      if (name && name.trim().length > 0) return name
      return t('courses.highscores.unknownPlayer')
    },
    [displayNameByUid, t],
  )

  async function handleRenameCourse(e: React.FormEvent) {
    e.preventDefault()
    if (!course || !isAdmin) return
    const nameError = validateCourseName(renameName)
    if (nameError) {
      setRenameError(t('courses.errors.courseNameRequired'))
      return
    }
    setRenaming(true)
    setRenameError(null)
    try {
      await updateCourseDetails({
        courseId: course.id,
        name: renameName,
        city: normalizeCourseCity(renameCity),
      })
      setRenameDraft(null)
    } catch (err) {
      setRenameError(
        err instanceof Error ? translateUserError(t, err.message) : t('courses.errors.renameCourseFailed'),
      )
    } finally {
      setRenaming(false)
    }
  }

  async function handleDeleteCourse() {
    if (!course || !isAdmin) return
    if (!window.confirm(t('courses.deleteCourseConfirm', { courseName: course.name }))) {
      return
    }
    setDeletingCourse(true)
    setDeleteCourseError(null)
    try {
      await deleteCourseWithTemplates(course.id)
      navigate('/courses', { replace: true })
    } catch (err) {
      setDeleteCourseError(
        err instanceof Error ? translateUserError(t, err.message) : t('courses.deleteCourseError'),
      )
    } finally {
      setDeletingCourse(false)
    }
  }

  if (coursesLoaded && !course && !courseError) {
    return (
      <section className="course-detail" aria-label={t('courses.detail.notFoundTitle')}>
        <button
          type="button"
          className="course-detail__back"
          onClick={() => navigate('/courses')}
        >
          {t('courses.actions.back')}
        </button>
        <p className="course-picker__empty">{t('courses.detail.notFound')}</p>
      </section>
    )
  }

  return (
    <section className="course-detail" aria-label={course?.name ?? ''}>
      <button
        type="button"
        className="course-detail__back"
        onClick={() => navigate('/courses')}
      >
        {t('courses.actions.back')}
      </button>

      {courseError ? (
        <p className="course-picker__error" role="alert">
          {courseError}
        </p>
      ) : null}

      {course ? (
        <>
          <header
            className="course-picker__overview-header"
            aria-labelledby="course-detail-name"
          >
            <h2 id="course-detail-name" className="course-picker__overview-name">
              {course.name}
            </h2>
            <p className="course-picker__overview-meta">
              {[
                course.city,
                resolvedTemplate
                  ? t('courses.templateMeta.holeCount', { count: resolvedTemplate.holes.length })
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </header>

          {resolvedTemplate ? (
            <CourseHighscoresPanel
              key={`${course.id}-highscores`}
              entries={highscoreEntries}
              stats={overviewStats}
              loadError={roundsError}
              resolveDisplayName={resolveDisplayName}
            />
          ) : null}

          <section
            className="course-picker__panel course-picker__panel--details"
            aria-labelledby="course-detail-overview-title"
          >
            <h3 id="course-detail-overview-title" className="course-picker__panel-title">
              {t('courses.overview.title')}
            </h3>

            {templatesError ? (
              <p className="course-picker__error" role="alert">
                {templatesError}
              </p>
            ) : null}

            {resolvedTemplate ? (
              canEditActiveTemplate ? (
                <CoursePickerTemplatePanel
                  key={`${course.id}-${resolvedTemplate.id}`}
                  courseId={course.id}
                  template={resolvedTemplate}
                  canEdit
                  holeStats={overviewStats.holeStats}
                />
              ) : (
                <CourseTemplateReadOnly
                  key={`${course.id}-${resolvedTemplate.id}-ro`}
                  template={resolvedTemplate}
                  holeStats={overviewStats.holeStats}
                />
              )
            ) : templates.length === 0 && !templatesError ? (
              <p className="course-picker__empty">{t('courses.empty.noLayouts')}</p>
            ) : null}

            {isAdmin ? (
              <form className="course-picker__add" onSubmit={(e) => void handleRenameCourse(e)}>
                <label className="course-picker__add-label" htmlFor="course-detail-course-name">
                  {t('courses.forms.courseName')}
                </label>
                <div className="course-picker__add-row">
                  <input
                    id="course-detail-course-name"
                    value={renameName}
                    onChange={(e) =>
                      setRenameDraft({ name: e.target.value, city: renameCity })
                    }
                    autoComplete="off"
                    disabled={renaming}
                  />
                  <input
                    id="course-detail-course-city"
                    aria-label={t('courses.aria.courseCity')}
                    value={renameCity}
                    onChange={(e) =>
                      setRenameDraft({ name: renameName, city: e.target.value })
                    }
                    placeholder={t('courses.forms.cityPlaceholder')}
                    autoComplete="off"
                    disabled={renaming}
                  />
                  <button
                    type="submit"
                    disabled={renaming || validateCourseName(renameName) !== null}
                  >
                    {renaming ? t('courses.actions.saving') : t('courses.actions.saveName')}
                  </button>
                </div>
                {renameError ? (
                  <p className="course-picker__error" role="alert">
                    {renameError}
                  </p>
                ) : null}
              </form>
            ) : null}

            {isAdmin ? (
              <form className="course-picker__add" onSubmit={(e) => e.preventDefault()}>
                <label className="course-picker__add-label">{t('courses.deleteCourseLabel')}</label>
                <div className="course-picker__add-row">
                  <button
                    type="button"
                    className="course-picker__btn--danger"
                    onClick={() => void handleDeleteCourse()}
                    disabled={deletingCourse}
                  >
                    {deletingCourse ? t('courses.deletingCourse') : t('courses.deleteCourse')}
                  </button>
                </div>
                {deleteCourseError ? (
                  <p className="course-picker__error" role="alert">
                    {deleteCourseError}
                  </p>
                ) : null}
              </form>
            ) : null}
          </section>
        </>
      ) : null}
    </section>
  )
}
