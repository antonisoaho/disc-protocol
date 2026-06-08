export type ParticipantHoleScoreCell = {
  strokes: number
  par: number
}

export type ParticipantHoleScoreGrid = Record<string, Record<string, ParticipantHoleScoreCell>>

export type ParticipantHoleScorePatch = {
  participantUid: string
  holeKey: string
  strokes: number
  par: number
}

export function applyParticipantHoleScorePatches(
  current: ParticipantHoleScoreGrid | undefined,
  patches: ReadonlyArray<ParticipantHoleScorePatch>,
): ParticipantHoleScoreGrid {
  const next: ParticipantHoleScoreGrid = {}
  if (current) {
    for (const [participantId, holeMap] of Object.entries(current)) {
      next[participantId] = { ...holeMap }
    }
  }

  for (const patch of patches) {
    next[patch.participantUid] = {
      ...(next[patch.participantUid] ?? {}),
      [patch.holeKey]: {
        strokes: patch.strokes,
        par: patch.par,
      },
    }
  }

  return next
}
