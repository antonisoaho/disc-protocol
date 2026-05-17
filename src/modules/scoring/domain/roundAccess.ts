import type { RoundDoc } from '@core/domain/round'

export type RoundAccessMode = 'edit' | 'read' | 'denied'

export function resolveRoundAccess(round: RoundDoc, viewerUid: string): RoundAccessMode {
  if (round.participantIds.includes(viewerUid)) return 'edit'
  if (round.completedAt === null) return 'denied'
  if (round.visibility === 'public' || round.visibility === 'unlisted') return 'read'
  return 'denied'
}
