import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { CourseTemplateWithId } from '@core/domain/courseData'

type Props = {
  template: CourseTemplateWithId
}

export function CourseTemplateReadOnly({ template }: Props) {
  const { t } = useTranslation('common')

  const totals = useMemo(() => {
    let par = 0
    let lengthMeters = 0
    for (const hole of template.holes) {
      par += hole.par
      if (typeof hole.lengthMeters === 'number') lengthMeters += hole.lengthMeters
    }
    return { par, lengthMeters }
  }, [template.holes])

  return (
    <div className="course-overview">
      <dl className="course-overview__summary">
        <div className="course-overview__summary-row">
          <dt className="course-overview__summary-label">{t('courses.forms.layoutName')}</dt>
          <dd className="course-overview__summary-value">{template.label}</dd>
        </div>
        <div className="course-overview__summary-row">
          <dt className="course-overview__summary-label">{t('courses.forms.courseHoleCount')}</dt>
          <dd className="course-overview__summary-value">
            {t('courses.templateMeta.holeCount', { count: template.holes.length })}
          </dd>
        </div>
        <div className="course-overview__summary-row">
          <dt className="course-overview__summary-label">{t('courses.forms.holePar')}</dt>
          <dd className="course-overview__summary-value">{totals.par}</dd>
        </div>
        {totals.lengthMeters > 0 ? (
          <div className="course-overview__summary-row">
            <dt className="course-overview__summary-label">{t('courses.overview.totalLength')}</dt>
            <dd className="course-overview__summary-value">
              {t('courses.overview.totalLengthValue', { meters: totals.lengthMeters })}
            </dd>
          </div>
        ) : null}
      </dl>
      <table className="course-overview__hole-table">
        <thead>
          <tr>
            <th scope="col">{t('courses.forms.holeNumber')}</th>
            <th scope="col">{t('courses.forms.holePar')}</th>
            <th scope="col">{t('courses.forms.holeLength')}</th>
          </tr>
        </thead>
        <tbody>
          {template.holes.map((hole) => (
            <tr key={hole.number}>
              <td className="course-overview__hole-num">{hole.number}</td>
              <td>{hole.par}</td>
              <td>
                {typeof hole.lengthMeters === 'number' && hole.lengthMeters > 0
                  ? hole.lengthMeters
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
