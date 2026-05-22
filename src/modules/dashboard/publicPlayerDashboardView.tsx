import type { User } from 'firebase/auth'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { DashboardHome } from '@modules/dashboard/dashboardView'

type Props = {
  viewer: User
}

export function PublicPlayerDashboard({ viewer }: Props) {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation('common')
  if (!userId) {
    return <Navigate to="/players" replace />
  }
  const readOnly = userId !== viewer.uid
  return (
    <div className="public-player-dashboard">
      {readOnly ? (
        <button
          type="button"
          className="public-player-dashboard__back"
          onClick={() => navigate('/players')}
        >
          {t('players.actions.back')}
        </button>
      ) : null}
      <DashboardHome viewer={viewer} profileUid={userId} readOnly={readOnly} />
    </div>
  )
}
