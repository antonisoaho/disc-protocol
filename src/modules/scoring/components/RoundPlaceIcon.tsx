import { useTranslation } from 'react-i18next'

type Props = {
  place: number
}

export function RoundPlaceIcon({ place }: Props) {
  const { t } = useTranslation('common')

  if (place === 1) {
    return (
      <span className="round-results__place round-results__place--gold" aria-hidden="true" title={t('scoring.results.placeFirst')}>
        🏆
      </span>
    )
  }
  if (place === 2) {
    return (
      <span className="round-results__place round-results__place--silver" aria-hidden="true" title={t('scoring.results.placeSecond')}>
        🥈
      </span>
    )
  }
  if (place === 3) {
    return (
      <span className="round-results__place round-results__place--bronze" aria-hidden="true" title={t('scoring.results.placeThird')}>
        🥉
      </span>
    )
  }

  return (
    <span className="round-results__place round-results__place--numeric" aria-label={t('scoring.results.placeNumber', { place })}>
      {place}
    </span>
  )
}
