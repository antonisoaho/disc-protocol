import type { Timestamp } from 'firebase/firestore'
import type { CourseHoleTemplate } from '@core/domain/course'
import type { RoundDoc } from '@core/domain/round'
import {
  aggregateParticipantRound,
  readParticipantHoleScores,
  type IdRound,
} from '@core/domain/roundAnalytics'

export type CourseHighscoreEntry = {
  uid: string
  totalStrokes: number
  totalPar: number
  totalDelta: number
  roundId: string
  completedAtMs: number
}

export type ComputeCourseHighscoresOptions = {
  /** Number of entries to return. Defaults to 3. */
  limit?: number
}

const DEFAULT_LIMIT = 3

function completedAtToMs(completedAt: Timestamp | null | undefined): number {
  if (!completedAt || typeof completedAt.toMillis !== 'function') {
    return 0
  }
  try {
    return completedAt.toMillis()
  } catch {
    return 0
  }
}

function matchesCourse(round: RoundDoc, courseId: string): boolean {
  if (round.courseId === courseId) return true
  return round.coursePromotion?.targetCourseId === courseId
}

function compareEntries(a: CourseHighscoreEntry, b: CourseHighscoreEntry): number {
  if (a.totalStrokes !== b.totalStrokes) return a.totalStrokes - b.totalStrokes
  if (a.totalDelta !== b.totalDelta) return a.totalDelta - b.totalDelta
  return a.completedAtMs - b.completedAtMs
}

/**
 * Top scores on a single course, one entry per registered uid (their personal best).
 * Only completed rounds where the participant scored every hole of the active template
 * are eligible. Sorted by lowest total strokes, then lowest delta, then earliest completion.
 */
export function computeCourseHighscores(
  items: IdRound[],
  courseId: string,
  templateHoleCount: number,
  options?: ComputeCourseHighscoresOptions,
): CourseHighscoreEntry[] {
  const limit = options?.limit ?? DEFAULT_LIMIT
  const bestByUid = new Map<string, CourseHighscoreEntry>()

  for (const { id, data } of items) {
    if (data.completedAt === null) continue
    if (!matchesCourse(data, courseId)) continue
    const completedAtMs = completedAtToMs(data.completedAt)

    for (const uid of data.participantIds) {
      const aggregate = aggregateParticipantRound(data, uid)
      if (aggregate.scoredHoles !== templateHoleCount) continue

      const candidate: CourseHighscoreEntry = {
        uid,
        totalStrokes: aggregate.totalStrokes,
        totalPar: aggregate.totalPar,
        totalDelta: aggregate.totalDelta,
        roundId: id,
        completedAtMs,
      }
      const existing = bestByUid.get(uid)
      if (!existing || compareEntries(candidate, existing) < 0) {
        bestByUid.set(uid, candidate)
      }
    }
  }

  return [...bestByUid.values()].sort(compareEntries).slice(0, limit)
}

export type CourseHoleStat = {
  number: number
  par: number
  lengthMeters?: number | null
  /** Lowest single-hole strokes ever recorded across all participants on this course. */
  bestScore: number | null
  /** Mean strokes for this hole across every scored sample. */
  averageScore: number | null
  /** Number of (round, participant) pairs that scored this hole. */
  sampleCount: number
}

export type CourseOverviewStats = {
  /** Distinct completed rounds played on this course (one round shared by N players still counts once). */
  totalScorecards: number
  /** Distinct registered uids who have scored at least one hole on this course. */
  uniquePlayers: number
  /** Sum of strokes across every scored hole by every participant. */
  totalThrows: number
  /** Mean delta-to-par across full participant-rounds; `null` when no such samples exist. */
  averageNetDelta: number | null
  /** Per-hole best and average stats aligned to the active template. */
  holeStats: CourseHoleStat[]
}

/**
 * Aggregate counts derived from rounds matching this course (catalog id or
 * promoted-fresh target). `totalScorecards` is round-level — a single round
 * shared by multiple participants still counts as one scorecard.
 */
export function computeCourseOverviewStats(
  items: IdRound[],
  courseId: string,
  templateHoles: CourseHoleTemplate[],
): CourseOverviewStats {
  const templateHoleCount = templateHoles.length
  let totalScorecards = 0
  let totalThrows = 0
  let deltaSum = 0
  let deltaSamples = 0
  const uniqueUids = new Set<string>()
  const perHole = new Map<number, { best: number; total: number; count: number }>()

  for (const { data } of items) {
    if (data.completedAt === null) continue
    if (!matchesCourse(data, courseId)) continue
    totalScorecards += 1

    const participantScores = readParticipantHoleScores(data)

    for (const uid of data.participantIds) {
      const holeMap = participantScores[uid] ?? {}
      let scoredHoles = 0
      let strokes = 0
      let par = 0
      for (const score of Object.values(holeMap)) {
        scoredHoles += 1
        strokes += score.strokes
        par += score.par
      }
      if (scoredHoles === 0) continue

      uniqueUids.add(uid)
      totalThrows += strokes

      if (scoredHoles === templateHoleCount) {
        deltaSum += strokes - par
        deltaSamples += 1
      }

      for (const [holeKey, score] of Object.entries(holeMap)) {
        const holeNumber = Number(holeKey)
        if (!Number.isFinite(holeNumber) || holeNumber <= 0) continue
        const existing = perHole.get(holeNumber)
        if (!existing) {
          perHole.set(holeNumber, { best: score.strokes, total: score.strokes, count: 1 })
        } else {
          existing.best = Math.min(existing.best, score.strokes)
          existing.total += score.strokes
          existing.count += 1
        }
      }
    }
  }

  const holeStats: CourseHoleStat[] = templateHoles.map((hole) => {
    const stat = perHole.get(hole.number)
    return {
      number: hole.number,
      par: hole.par,
      lengthMeters: hole.lengthMeters ?? null,
      bestScore: stat ? stat.best : null,
      averageScore: stat ? stat.total / stat.count : null,
      sampleCount: stat ? stat.count : 0,
    }
  })

  return {
    totalScorecards,
    uniquePlayers: uniqueUids.size,
    totalThrows,
    averageNetDelta: deltaSamples > 0 ? deltaSum / deltaSamples : null,
    holeStats,
  }
}
