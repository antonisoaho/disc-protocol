import type { Timestamp } from 'firebase/firestore'
import type { RoundDoc } from '@core/domain/round'
import { aggregateParticipantRound, type IdRound } from '@core/domain/roundAnalytics'

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

export type CourseOverviewStats = {
  /** Number of (round, participant) pairs that played every hole on this course. */
  totalFullRounds: number
  /** Distinct registered uids with at least one full round on this course. */
  uniquePlayers: number
}

/**
 * Aggregate counts derived from the same eligibility rules as
 * `computeCourseHighscores`. Useful for a stats strip above the leaderboard.
 */
export function computeCourseOverviewStats(
  items: IdRound[],
  courseId: string,
  templateHoleCount: number,
): CourseOverviewStats {
  let totalFullRounds = 0
  const uniqueUids = new Set<string>()

  for (const { data } of items) {
    if (data.completedAt === null) continue
    if (!matchesCourse(data, courseId)) continue

    for (const uid of data.participantIds) {
      const aggregate = aggregateParticipantRound(data, uid)
      if (aggregate.scoredHoles !== templateHoleCount) continue
      totalFullRounds += 1
      uniqueUids.add(uid)
    }
  }

  return { totalFullRounds, uniquePlayers: uniqueUids.size }
}
