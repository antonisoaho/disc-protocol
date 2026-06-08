import { useTranslation } from 'react-i18next'
import type { CourseMode } from '@modules/rounds/domain/startRoundWizard'

type Props = {
  courseMode: CourseMode
  savedCourseName: string | null
  quickCourseName: string
  holeCount: number
  playerNames: string[]
}

export function StartRoundReviewStep({
  courseMode,
  savedCourseName,
  quickCourseName,
  holeCount,
  playerNames,
}: Props) {
  const { t } = useTranslation('common')

  const courseSummary =
    courseMode === 'saved' && savedCourseName
      ? t('rounds.new.wizard.review.savedCourse', { courseName: savedCourseName })
      : t('rounds.new.wizard.review.quickCourse', {
          courseName: quickCourseName.trim(),
          holeCount,
        })

  return (
    <div className="scoring-panel__section">
      <dl className="start-round-wizard__review-list">
        <div className="start-round-wizard__review-item">
          <dt className="start-round-wizard__review-label">{t('rounds.new.wizard.review.course')}</dt>
          <dd className="start-round-wizard__review-value">{courseSummary}</dd>
        </div>
        <div className="start-round-wizard__review-item">
          <dt className="start-round-wizard__review-label">{t('rounds.new.wizard.review.players')}</dt>
          <dd className="start-round-wizard__review-value">{playerNames.join(', ')}</dd>
        </div>
      </dl>
      <p className="scoring-panel__muted scoring-panel__hint">{t('rounds.new.visibilityPublicHint')}</p>
    </div>
  )
}
