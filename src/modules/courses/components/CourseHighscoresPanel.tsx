import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { translateUserError } from '@common/i18n/translateError'
import {
  computeCourseHighscores,
  type CourseHighscoreEntry,
} from '@core/domain/courseHighscores'
import { subscribeCourseRounds, type RoundListItem } from '@core/domain/rounds'
import { subscribeUserDirectory, type UserDirectoryEntry } from '@core/users/userDirectory'

type Props = {
  courseId: string
  templateHoleCount: number
}

function formatDelta(delta: number): string {
  if (delta === 0) return 'E'
  return delta > 0 ? `+${delta}` : `${delta}`
}

function deltaTokenClass(delta: number): string {
  if (delta <= -2) return 'course-highscores__delta--eagle'
  if (delta === -1) return 'course-highscores__delta--birdie'
  if (delta === 0) return 'course-highscores__delta--par'
  if (delta === 1) return 'course-highscores__delta--bogey'
  return 'course-highscores__delta--double-bogey-plus'
}

type RoundsState = {
  courseId: string
  rounds: RoundListItem[]
  loadError: string | null
}

export function CourseHighscoresPanel({ courseId, templateHoleCount }: Props) {
  const { t } = useTranslation('common')
  const [roundsState, setRoundsState] = useState<RoundsState>({
    courseId,
    rounds: [],
    loadError: null,
  })
  const [directory, setDirectory] = useState<UserDirectoryEntry[]>([])

  useEffect(() => {
    const unsub = subscribeCourseRounds(
      courseId,
      (items) => setRoundsState({ courseId, rounds: items, loadError: null }),
      (err) =>
        setRoundsState({ courseId, rounds: [], loadError: translateUserError(t, err.message) }),
    )
    return () => unsub()
  }, [courseId, t])

  const loadError = roundsState.courseId === courseId ? roundsState.loadError : null

  useEffect(() => {
    const unsub = subscribeUserDirectory(
      (entries) => setDirectory(entries),
      () => {},
    )
    return () => unsub()
  }, [])

  const entries = useMemo(() => {
    const items = roundsState.courseId === courseId ? roundsState.rounds : []
    return computeCourseHighscores(items, courseId, templateHoleCount)
  }, [roundsState, courseId, templateHoleCount])

  const displayNameByUid = useMemo(() => {
    const map = new Map<string, string>()
    for (const entry of directory) {
      map.set(entry.uid, entry.displayName)
    }
    return map
  }, [directory])

  function resolveDisplayName(uid: string): string {
    const name = displayNameByUid.get(uid)
    if (name && name.trim().length > 0) return name
    return t('courses.highscores.unknownPlayer')
  }

  return (
    <section
      className="course-picker__panel course-highscores"
      aria-labelledby="course-highscores-title"
    >
      <h3 id="course-highscores-title" className="course-picker__panel-title">
        {t('courses.highscores.title')}
      </h3>
      {loadError ? (
        <p className="course-picker__error" role="alert">
          {loadError}
        </p>
      ) : null}
      {entries.length === 0 && !loadError ? (
        <p className="course-picker__empty">{t('courses.highscores.empty')}</p>
      ) : null}
      {entries.length > 0 ? (
        <ol className="course-highscores__list">
          {entries.map((entry: CourseHighscoreEntry, index) => (
            <li key={entry.uid} className="course-highscores__row">
              <span className="course-highscores__rank">{index + 1}</span>
              <span className="course-highscores__name">{resolveDisplayName(entry.uid)}</span>
              <span className="course-highscores__score">
                {t('courses.highscores.strokesLabel', { count: entry.totalStrokes })}
              </span>
              <span className={`course-highscores__delta ${deltaTokenClass(entry.totalDelta)}`}>
                {t('courses.highscores.deltaToPar', { delta: formatDelta(entry.totalDelta) })}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  )
}
