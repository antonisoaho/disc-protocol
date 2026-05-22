import { useTranslation } from 'react-i18next'
import type {
  CourseHighscoreEntry,
  CourseOverviewStats,
} from '@core/domain/courseHighscores'

type Props = {
  entries: CourseHighscoreEntry[]
  stats: CourseOverviewStats
  loadError: string | null
  resolveDisplayName: (uid: string) => string
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

function formatAverageDelta(delta: number | null): string {
  if (delta === null) return '—'
  if (delta === 0) return 'E'
  const rounded = Math.round(delta * 10) / 10
  return rounded > 0 ? `+${rounded}` : `${rounded}`
}

export function CourseHighscoresPanel({ entries, stats, loadError, resolveDisplayName }: Props) {
  const { t } = useTranslation('common')

  return (
    <section
      className="course-picker__panel course-highscores"
      aria-labelledby="course-highscores-title"
    >
      <h3 id="course-highscores-title" className="course-picker__panel-title">
        {t('courses.highscores.title')}
      </h3>
      <dl className="course-highscores__stats" aria-label={t('courses.stats.ariaSummary')}>
        <div className="course-highscores__stat">
          <dt className="course-highscores__stat-label">{t('courses.stats.totalRounds')}</dt>
          <dd className="course-highscores__stat-value">{stats.totalScorecards}</dd>
        </div>
        <div className="course-highscores__stat">
          <dt className="course-highscores__stat-label">{t('courses.stats.uniquePlayers')}</dt>
          <dd className="course-highscores__stat-value">{stats.uniquePlayers}</dd>
        </div>
        <div className="course-highscores__stat">
          <dt className="course-highscores__stat-label">{t('courses.stats.totalThrows')}</dt>
          <dd className="course-highscores__stat-value">{stats.totalThrows}</dd>
        </div>
        <div className="course-highscores__stat">
          <dt className="course-highscores__stat-label">{t('courses.stats.averageNet')}</dt>
          <dd className="course-highscores__stat-value">{formatAverageDelta(stats.averageNetDelta)}</dd>
        </div>
      </dl>
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
          {entries.map((entry, index) => (
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
