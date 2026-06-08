import type { CourseHoleTemplate } from '@core/domain/course'
import type { ParticipantHoleScores } from '@core/domain/scorecardTable'
import type { RoundCourseDraftHole, RoundCourseSource } from '@core/domain/round'

export type RoundHoleMetadata = {
  par: number | null
  lengthMeters: number | null
}

function readParFromScores(
  holeNumber: number,
  participantIds: readonly string[],
  scoresByParticipant: ParticipantHoleScores,
): number | null {
  const holeKey = String(holeNumber)
  for (const participantId of participantIds) {
    const par = scoresByParticipant[participantId]?.[holeKey]?.par
    if (typeof par === 'number') {
      return par
    }
  }
  return null
}

function readLayoutHole(layoutHoles: CourseHoleTemplate[] | null | undefined, holeNumber: number) {
  if (!layoutHoles || layoutHoles.length === 0) {
    return null
  }
  return layoutHoles.find((hole) => hole.number === holeNumber) ?? layoutHoles[holeNumber - 1] ?? null
}

function readDraftHole(draftHoles: RoundCourseDraftHole[] | null | undefined, holeNumber: number) {
  if (!draftHoles || draftHoles.length === 0) {
    return null
  }
  return draftHoles.find((hole) => hole.number === holeNumber) ?? draftHoles[holeNumber - 1] ?? null
}

/** Par and length per hole from course layout/draft, with score snapshots as fallback for par. */
export function buildRoundHoleMetadataByNumber(params: {
  holeCount: number
  courseSource?: RoundCourseSource | null
  courseDraftHoles?: RoundCourseDraftHole[] | null
  layoutHoles?: CourseHoleTemplate[] | null
  scoresByParticipant?: ParticipantHoleScores
  participantIds?: readonly string[]
}): Record<number, RoundHoleMetadata> {
  const out: Record<number, RoundHoleMetadata> = {}
  const participantIds = params.participantIds ?? []
  const scoresByParticipant = params.scoresByParticipant ?? {}
  const courseSource = params.courseSource ?? 'saved'

  for (let holeNumber = 1; holeNumber <= params.holeCount; holeNumber += 1) {
    const scorePar = readParFromScores(holeNumber, participantIds, scoresByParticipant)

    if (courseSource === 'fresh') {
      const draftHole = readDraftHole(params.courseDraftHoles, holeNumber)
      out[holeNumber] = {
        par: typeof draftHole?.par === 'number' ? draftHole.par : scorePar,
        lengthMeters: typeof draftHole?.lengthMeters === 'number' ? draftHole.lengthMeters : null,
      }
      continue
    }

    const layoutHole = readLayoutHole(params.layoutHoles, holeNumber)
    out[holeNumber] = {
      par: typeof layoutHole?.par === 'number' ? layoutHole.par : scorePar,
      lengthMeters: typeof layoutHole?.lengthMeters === 'number' ? layoutHole.lengthMeters : null,
    }
  }

  return out
}
