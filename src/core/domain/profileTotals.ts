import type { CourseHoleTemplate } from '@core/domain/course'
import type { RoundDoc } from '@core/domain/round'
import {
  deriveCourseGrouping,
  readParticipantHoleScores,
} from '@core/domain/roundAnalytics'

export type ComputeProfileTotalsOptions = {
  /** Restrict to rounds whose course grouping key matches (mirrors dashboard course filter). */
  courseKey?: string
}

export type ProfileTotals = {
  /** Sum of strokes the user has thrown across every completed scored hole. */
  totalThrows: number
  /** Sum of `lengthMeters` for every scored hole that has a known length. */
  totalMeters: number
}

/**
 * Walks the user's completed rounds and sums strokes plus per-hole meters.
 * For `fresh` rounds the hole lengths come from `courseDraft.holes`; for saved
 * rounds the caller passes a map keyed by `templateId`.
 */
export function computeProfileTotals(
  rounds: RoundDoc[],
  participantUid: string,
  templateHolesByTemplateId: Map<string, CourseHoleTemplate[]>,
  options?: ComputeProfileTotalsOptions,
): ProfileTotals {
  let totalThrows = 0
  let totalMeters = 0
  const courseKey = options?.courseKey

  for (const round of rounds) {
    if (round.completedAt === null) continue
    if (!round.participantIds.includes(participantUid)) continue
    if (courseKey && deriveCourseGrouping(round).key !== courseKey) continue

    const holeMap = readParticipantHoleScores(round)[participantUid] ?? {}
    if (Object.keys(holeMap).length === 0) continue

    const lengthByHole = new Map<number, number | null | undefined>()
    if (round.courseSource === 'fresh' && round.courseDraft?.holes) {
      for (const h of round.courseDraft.holes) {
        lengthByHole.set(h.number, h.lengthMeters ?? null)
      }
    } else {
      const tplHoles = templateHolesByTemplateId.get(round.templateId)
      if (tplHoles) {
        for (const h of tplHoles) {
          lengthByHole.set(h.number, h.lengthMeters ?? null)
        }
      }
    }

    for (const [holeKey, score] of Object.entries(holeMap)) {
      totalThrows += score.strokes
      const holeNumber = Number(holeKey)
      if (!Number.isFinite(holeNumber) || holeNumber <= 0) continue
      const length = lengthByHole.get(holeNumber)
      if (typeof length === 'number' && length > 0) {
        totalMeters += length
      }
    }
  }

  return { totalThrows, totalMeters }
}

export type ProfileWinSummary = {
  /** Rounds where the user uniquely had the lowest total strokes vs registered opponents. */
  wins: number
  /** Multi-player rounds eligible for win comparison (everyone scored same hole count > 0). */
  comparableRounds: number
}

type ComputeProfileWinOptions = ComputeProfileTotalsOptions

/**
 * Count strict-win rounds where the user beat every other registered participant.
 * Mirrors the head-to-head eligibility rule: every participant must have scored
 * the same number of holes (> 0), and the user's total strokes must be strictly
 * lower than every other participant's.
 */
export function computeProfileWinCount(
  rounds: RoundDoc[],
  participantUid: string,
  options?: ComputeProfileWinOptions,
): ProfileWinSummary {
  const courseKey = options?.courseKey
  let wins = 0
  let comparableRounds = 0

  for (const round of rounds) {
    if (round.completedAt === null) continue
    if (!round.participantIds.includes(participantUid)) continue
    if (courseKey && deriveCourseGrouping(round).key !== courseKey) continue

    const perParticipant = readParticipantHoleScores(round)
    const mineMap = perParticipant[participantUid] ?? {}
    const mineHoles = Object.keys(mineMap).length
    if (mineHoles === 0) continue

    type Aggregate = { uid: string; strokes: number; scoredHoles: number }
    const opponents: Aggregate[] = []
    let mismatchedHoleCount = false
    for (const uid of round.participantIds) {
      if (uid === participantUid) continue
      const holeMap = perParticipant[uid] ?? {}
      const scoredHoles = Object.keys(holeMap).length
      if (scoredHoles === 0) continue
      if (scoredHoles !== mineHoles) {
        mismatchedHoleCount = true
        break
      }
      let strokes = 0
      for (const score of Object.values(holeMap)) strokes += score.strokes
      opponents.push({ uid, strokes, scoredHoles })
    }
    if (mismatchedHoleCount) continue
    if (opponents.length === 0) continue

    let myStrokes = 0
    for (const score of Object.values(mineMap)) myStrokes += score.strokes

    comparableRounds += 1
    const beatsEveryone = opponents.every((o) => myStrokes < o.strokes)
    if (beatsEveryone) wins += 1
  }

  return { wins, comparableRounds }
}

/**
 * Human-readable meters total. Below 1000m prints `N m`; otherwise prints
 * `N.Nk m` (one decimal). Zero renders as `—`.
 */
export function formatMetersPlayed(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return '—'
  if (meters < 1000) return `${Math.round(meters)} m`
  const kilo = meters / 1000
  return `${kilo.toFixed(1)}k m`
}
