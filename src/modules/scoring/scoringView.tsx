import type { User } from 'firebase/auth'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Navigate, useNavigate, useParams } from 'react-router-dom'
import { subscribeRound, type RoundListItem } from '@core/domain/rounds'
import { ScoringPanel } from '@modules/scoring/components/ScoringPanel'
import { ReadOnlyScorecard } from '@modules/scoring/components/ReadOnlyScorecard'
import { resolveRoundAccess } from '@modules/scoring/domain/roundAccess'

type Props = {
  user: User
}

type LoadState =
  | { status: 'loading' }
  | { status: 'loaded'; round: RoundListItem }
  | { status: 'missing' }

export function ScoringView({ user }: Props) {
  const { t } = useTranslation('common')
  const { roundId } = useParams()
  const navigate = useNavigate()
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    if (!roundId) return
    const unsub = subscribeRound(
      roundId,
      (item) => setLoad(item ? { status: 'loaded', round: item } : { status: 'missing' }),
      () => setLoad({ status: 'missing' }),
    )
    return () => unsub()
  }, [roundId])

  if (!roundId) {
    return <Navigate to="/" replace />
  }

  const access = load.status === 'loaded' ? resolveRoundAccess(load.round.data, user.uid) : null

  return (
    <div className="app-shell__flow">
      <NavLink to="/" className="app-shell__link dashboard-home__back">
        {t('rounds.scorecard.backHome')}
      </NavLink>
      {load.status === 'loading' ? null : load.status === 'missing' || access === 'denied' ? (
        <p className="scoring-panel__error" role="alert">
          {t('rounds.scorecard.notFoundOrNoAccess')}
        </p>
      ) : access === 'edit' ? (
        <ScoringPanel
          key={roundId}
          user={user}
          roundId={roundId}
          onAfterRoundDeleted={() => navigate('/')}
        />
      ) : (
        <ReadOnlyScorecard round={load.round.data} />
      )}
    </div>
  )
}
