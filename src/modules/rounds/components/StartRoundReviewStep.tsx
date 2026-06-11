import { useTranslation } from 'react-i18next'
import type { CourseMode, WizardScoringMode } from '@modules/rounds/domain/startRoundWizard'

export type ReviewTeamSummary = {
  name: string
  memberNames: string
}

type Props = {
  courseMode: CourseMode
  savedCourseName: string | null
  quickCourseName: string
  holeCount: number
  playerNames: string[]
  scoringMode: WizardScoringMode
  teamSummaries: ReviewTeamSummary[]
}

export function StartRoundReviewStep({
  courseMode,
  savedCourseName,
  quickCourseName,
  holeCount,
  playerNames,
  scoringMode,
  teamSummaries,
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
        {playerNames.length >= 2 ? (
          <div className="start-round-wizard__review-item">
            <dt className="start-round-wizard__review-label">{t('rounds.new.wizard.review.format')}</dt>
            <dd className="start-round-wizard__review-value">
              {scoringMode === 'scramble'
                ? t('rounds.new.wizard.review.formatScramble')
                : t('rounds.new.wizard.review.formatIndividual')}
            </dd>
          </div>
        ) : null}
        {teamSummaries.length > 0 ? (
          <div className="start-round-wizard__review-item">
            <dt className="start-round-wizard__review-label">{t('rounds.new.wizard.review.teams')}</dt>
            <dd className="start-round-wizard__review-value">
              <ul className="start-round-wizard__review-team-list">
                {teamSummaries.map((team) => (
                  <li key={team.name}>
                    {t('rounds.new.wizard.review.teamLine', {
                      teamName: team.name,
                      members: team.memberNames,
                    })}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
      </dl>
      <p className="scoring-panel__muted scoring-panel__hint">{t('rounds.new.visibilityPublicHint')}</p>
    </div>
  )
}
