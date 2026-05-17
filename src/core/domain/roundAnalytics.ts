import type { Timestamp } from 'firebase/firestore'
import type { RoundDoc } from '@core/domain/round'

/** Round row with Firestore id (matches `RoundListItem` in firebase/rounds). */
export type IdRound = { id: string; data: RoundDoc }

export type RoundDeltaSample = {
  roundId: string
  /** Milliseconds from `startedAt`, or 0 if missing. */
  dateMs: number
  totalDelta: number
  scoredHoles: number
}

export type PlayedCourse = {
  /** Stable grouping key: `catalog:<courseId>` or `fresh:<normalized name>`. */
  key: string
  /** Human-readable label captured from the first round in the group. */
  label: string
  source: 'catalog' | 'fresh'
}

export type ListParticipantRoundDeltasOptions = {
  /** Restrict samples to rounds whose course key matches. */
  courseKey?: string
}

function deriveCourseGrouping(round: RoundDoc): PlayedCourse {
  const isFresh = round.courseSource === 'fresh'
  const promotedTarget = round.coursePromotion?.targetCourseId ?? null
  if (isFresh && !promotedTarget) {
    const rawName = round.courseDraft?.name ?? ''
    const trimmed = rawName.trim()
    return {
      key: `fresh:${trimmed.toLowerCase()}`,
      label: trimmed || round.courseId,
      source: 'fresh',
    }
  }
  const catalogId = promotedTarget ?? round.courseId
  const label =
    round.courseName?.trim() ||
    round.courseDraft?.name?.trim() ||
    catalogId
  return {
    key: `catalog:${catalogId}`,
    label,
    source: 'catalog',
  }
}

function startedAtToMs(startedAt: Timestamp | null | undefined): number {
  if (!startedAt || typeof startedAt.toMillis !== 'function') {
    return 0
  }
  try {
    return startedAt.toMillis()
  } catch {
    return 0
  }
}

/**
 * Completed rounds where the participant recorded at least one hole, oldest → newest.
 * Used for per-round averages and trend charts (strokes vs par per round).
 */
export function listParticipantRoundDeltasChronological(
  items: IdRound[],
  participantUid: string,
  options?: ListParticipantRoundDeltasOptions,
): RoundDeltaSample[] {
  const courseKey = options?.courseKey
  const rows: RoundDeltaSample[] = []
  for (const { id, data } of items) {
    if (!isCompletedRound(data) || !data.participantIds.includes(participantUid)) {
      continue
    }
    if (courseKey && deriveCourseGrouping(data).key !== courseKey) {
      continue
    }
    const participantRound = aggregateParticipantRound(data, participantUid)
    if (participantRound.scoredHoles === 0) {
      continue
    }
    rows.push({
      roundId: id,
      dateMs: startedAtToMs(data.startedAt),
      totalDelta: participantRound.totalDelta,
      scoredHoles: participantRound.scoredHoles,
    })
  }
  rows.sort((a, b) => a.dateMs - b.dateMs)
  return rows
}

/**
 * Distinct courses the participant has a completed, scored round on.
 * Catalog rounds (and promoted-fresh rounds with a target course) group by `courseId`;
 * unpromoted fresh rounds group by normalized draft name. Output is sorted by label.
 */
export function listParticipantPlayedCourses(
  items: IdRound[],
  participantUid: string,
): PlayedCourse[] {
  const groups = new Map<string, PlayedCourse>()
  for (const { data } of items) {
    if (!isCompletedRound(data) || !data.participantIds.includes(participantUid)) {
      continue
    }
    const participantRound = aggregateParticipantRound(data, participantUid)
    if (participantRound.scoredHoles === 0) {
      continue
    }
    const grouping = deriveCourseGrouping(data)
    if (!groups.has(grouping.key)) {
      groups.set(grouping.key, grouping)
    }
  }
  return [...groups.values()].sort((a, b) =>
    a.label.toLowerCase().localeCompare(b.label.toLowerCase()),
  )
}

type ParticipantAggregate = {
  scoredHoles: number
  totalStrokes: number
  totalPar: number
  totalDelta: number
}

export type ParticipantParSummary = {
  completedRounds: number
  scoredRounds: number
  scoredHoles: number
  totalStrokes: number
  totalPar: number
  totalDelta: number
}

export type HeadToHeadSummary = {
  opponentUid: string
  sharedCompletedRounds: number
  comparedRounds: number
  skippedRounds: number
  wins: number
  losses: number
  ties: number
}

function isCompletedRound(round: RoundDoc): boolean {
  return round.completedAt !== null
}

function readParticipantHoleScores(round: RoundDoc) {
  const next: Record<string, Record<string, { strokes: number; par: number }>> = {}
  const participantIdSet = new Set(round.participantIds)

  for (const participantId of round.participantIds) {
    next[participantId] = {}
  }

  if (round.participantHoleScores && Object.keys(round.participantHoleScores).length > 0) {
    for (const [participantId, holeMap] of Object.entries(round.participantHoleScores)) {
      next[participantId] = next[participantId] ?? {}
      for (const [holeKey, score] of Object.entries(holeMap)) {
        next[participantId][holeKey] = {
          strokes: score.strokes,
          par: score.par,
        }
      }
    }
    return next
  }

  for (const [holeKey, score] of Object.entries(round.holeScores ?? {})) {
    const owner =
      typeof score.updatedBy === 'string' && participantIdSet.has(score.updatedBy)
        ? score.updatedBy
        : round.ownerId
    next[owner] = next[owner] ?? {}
    next[owner][holeKey] = {
      strokes: score.strokes,
      par: score.par,
    }
  }

  return next
}

function aggregateParticipantRound(round: RoundDoc, participantUid: string): ParticipantAggregate {
  const participantScores = readParticipantHoleScores(round)[participantUid] ?? {}
  let scoredHoles = 0
  let totalStrokes = 0
  let totalPar = 0

  for (const score of Object.values(participantScores)) {
    scoredHoles += 1
    totalStrokes += score.strokes
    totalPar += score.par
  }

  return {
    scoredHoles,
    totalStrokes,
    totalPar,
    totalDelta: totalStrokes - totalPar,
  }
}

export function computeParticipantParSummary(rounds: RoundDoc[], participantUid: string): ParticipantParSummary {
  const summary: ParticipantParSummary = {
    completedRounds: 0,
    scoredRounds: 0,
    scoredHoles: 0,
    totalStrokes: 0,
    totalPar: 0,
    totalDelta: 0,
  }

  for (const round of rounds) {
    if (!isCompletedRound(round) || !round.participantIds.includes(participantUid)) {
      continue
    }

    summary.completedRounds += 1
    const participantRound = aggregateParticipantRound(round, participantUid)
    if (participantRound.scoredHoles === 0) {
      continue
    }

    summary.scoredRounds += 1
    summary.scoredHoles += participantRound.scoredHoles
    summary.totalStrokes += participantRound.totalStrokes
    summary.totalPar += participantRound.totalPar
    summary.totalDelta += participantRound.totalDelta
  }

  return summary
}

export function computeHeadToHeadSummary(
  rounds: RoundDoc[],
  participantUid: string,
  opponentUid: string,
): HeadToHeadSummary {
  const summary: HeadToHeadSummary = {
    opponentUid,
    sharedCompletedRounds: 0,
    comparedRounds: 0,
    skippedRounds: 0,
    wins: 0,
    losses: 0,
    ties: 0,
  }

  for (const round of rounds) {
    if (
      !isCompletedRound(round) ||
      !round.participantIds.includes(participantUid) ||
      !round.participantIds.includes(opponentUid)
    ) {
      continue
    }

    summary.sharedCompletedRounds += 1

    const mine = aggregateParticipantRound(round, participantUid)
    const theirs = aggregateParticipantRound(round, opponentUid)
    if (mine.scoredHoles === 0 || theirs.scoredHoles === 0 || mine.scoredHoles !== theirs.scoredHoles) {
      summary.skippedRounds += 1
      continue
    }

    summary.comparedRounds += 1
    if (mine.totalDelta < theirs.totalDelta) {
      summary.wins += 1
      continue
    }
    if (mine.totalDelta > theirs.totalDelta) {
      summary.losses += 1
      continue
    }
    if (mine.totalStrokes < theirs.totalStrokes) {
      summary.wins += 1
      continue
    }
    if (mine.totalStrokes > theirs.totalStrokes) {
      summary.losses += 1
      continue
    }
    summary.ties += 1
  }

  return summary
}
