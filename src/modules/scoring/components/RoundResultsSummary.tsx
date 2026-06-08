import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  buildRoundResultStandings,
  pickWinnerNames,
  type RoundResultUnit,
} from '@modules/scoring/domain/buildRoundResultStandings'
import type { ParticipantTotals } from '@core/domain/scorecardTable'
import { RoundPlaceIcon } from '@modules/scoring/components/RoundPlaceIcon'

type Props = {
  units: RoundResultUnit[]
  totalsByParticipant: Record<string, ParticipantTotals>
}

export function RoundResultsSummary({ units, totalsByParticipant }: Props) {
  const { t } = useTranslation('common')

  const standings = useMemo(
    () => buildRoundResultStandings(units, totalsByParticipant),
    [totalsByParticipant, units],
  )

  const winnerNames = useMemo(() => pickWinnerNames(standings), [standings])

  if (standings.length === 0) {
    return null
  }

  const winnerLabel =
    winnerNames.length > 1
      ? t('scoring.results.winnersTied', { names: winnerNames.join(', ') })
      : t('scoring.results.winnerSingle', { name: winnerNames[0] ?? '' })

  return (
    <div className="round-results">
      <p className="round-results__winner" role="status">
        {winnerLabel}
      </p>
      <ul className="round-results__standings" aria-label={t('scoring.results.standingsAria')}>
        {standings.map((row) => (
          <li key={row.id} className="round-results__standing">
            <RoundPlaceIcon place={row.place} />
            <span className="round-results__line">
              {t('scoring.results.resultLine', {
                name: row.displayName,
                strokes: row.totalStrokes,
                toPar: row.toParLabel,
              })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
