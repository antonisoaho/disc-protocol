import { doc, onSnapshot, type Timestamp } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CourseTemplateDoc } from '@core/domain/course'
import type { RoundDoc, RoundAnonymousParticipant } from '@core/domain/round'
import { COLLECTIONS } from '@core/firebase/paths'
import { db } from '@core/firebase/firestore'
import { inferRoundHoleCount } from '@core/domain/inferRoundHoleCount'
import { aggregateScoreProtocol, normalizeScoreProtocol } from '@core/domain/scoreProtocol'
import { buildAnonymousParticipantNameMap } from '@core/domain/participantRoster'
import { subscribeUserDirectory, type UserDirectoryEntry } from '@core/users/userDirectory'
import { RoundResultsSummary } from '@modules/scoring/components/RoundResultsSummary'
import { ScorecardSummaryGrid } from '@modules/scoring/components/ScorecardSummaryGrid'
import { buildRoundResultUnits } from '@modules/scoring/domain/buildRoundResultStandings'
import { buildRoundHoleMetadataByNumber } from '@modules/scoring/domain/buildRoundHoleMetadata'
import { isScrambleRound, resolveScrambleGridRows } from '@core/domain/scrambleScoring'
import { normalizeRoundTeams } from '@core/domain/roundTeams'

type Props = {
  round: RoundDoc
}

function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : `${delta}`
}

function formatTimestamp(ts: Timestamp | null | undefined, locale: string): string {
  if (!ts) return ''
  try {
    return ts.toDate().toLocaleString(locale)
  } catch {
    return ''
  }
}

function readParticipantHoleScores(data: RoundDoc) {
  const next: Record<string, Record<string, { strokes: number; par: number }>> = {}
  const participantIdSet = new Set(data.participantIds)
  for (const participantId of data.participantIds) {
    next[participantId] = {}
  }
  if (data.participantHoleScores && Object.keys(data.participantHoleScores).length > 0) {
    for (const [participantId, holeMap] of Object.entries(data.participantHoleScores)) {
      next[participantId] = next[participantId] ?? {}
      for (const [holeKey, score] of Object.entries(holeMap)) {
        next[participantId][holeKey] = { strokes: score.strokes, par: score.par }
      }
    }
    return next
  }
  for (const [holeKey, score] of Object.entries(data.holeScores ?? {})) {
    const owner =
      typeof score.updatedBy === 'string' && participantIdSet.has(score.updatedBy)
        ? score.updatedBy
        : data.ownerId
    next[owner] = next[owner] ?? {}
    next[owner][holeKey] = { strokes: score.strokes, par: score.par }
  }
  return next
}

function deriveCourseLabel(round: RoundDoc, fallback: string): string {
  if (round.courseSource === 'fresh') {
    return round.courseDraft?.name?.trim() || fallback
  }
  return round.courseName?.trim() || fallback
}

export function ReadOnlyScorecard({ round }: Props) {
  const { t, i18n } = useTranslation('common')
  const [directoryEntries, setDirectoryEntries] = useState<UserDirectoryEntry[]>([])
  const [layoutHoles, setLayoutHoles] = useState<CourseTemplateDoc['holes'] | null>(null)

  useEffect(() => {
    const unsub = subscribeUserDirectory(
      (entries) => setDirectoryEntries(entries),
      () => {},
    )
    return () => unsub()
  }, [])

  useEffect(() => {
    if (round.courseSource !== 'saved') {
      queueMicrotask(() => setLayoutHoles(null))
      return
    }
    const templateRef = doc(db, COLLECTIONS.courses, round.courseId, COLLECTIONS.templates, round.templateId)
    return onSnapshot(templateRef, (snapshot) => {
      queueMicrotask(() => {
        setLayoutHoles(snapshot.exists() ? (snapshot.data() as CourseTemplateDoc).holes : null)
      })
    })
  }, [round.courseId, round.courseSource, round.templateId])

  const holeCount = useMemo(() => inferRoundHoleCount(round) ?? 0, [round])
  const scoresByParticipant = useMemo(() => readParticipantHoleScores(round), [round])
  const holeMetadataByNumber = useMemo(
    () =>
      buildRoundHoleMetadataByNumber({
        holeCount,
        courseSource: round.courseSource,
        courseDraftHoles: round.courseDraft?.holes,
        layoutHoles,
        scoresByParticipant,
        participantIds: round.participantIds,
      }),
    [holeCount, layoutHoles, round.courseDraft?.holes, round.courseSource, round.participantIds, scoresByParticipant],
  )
  const anonymousNames = useMemo(
    () => buildAnonymousParticipantNameMap(round.anonymousParticipants ?? ([] as RoundAnonymousParticipant[])),
    [round.anonymousParticipants],
  )
  const directoryByUid = useMemo(() => {
    const map: Record<string, UserDirectoryEntry> = {}
    for (const entry of directoryEntries) map[entry.uid] = entry
    return map
  }, [directoryEntries])

  const participantNames = useMemo(() => {
    const names: Record<string, string> = {}
    for (const participantId of round.participantIds) {
      const anonymous = anonymousNames[participantId]
      if (anonymous) {
        names[participantId] = anonymous
        continue
      }
      const entry = directoryByUid[participantId]
      names[participantId] =
        entry && entry.displayName.trim().length > 0 ? entry.displayName.trim() : participantId
    }
    return names
  }, [anonymousNames, directoryByUid, round.participantIds])

  const totals = useMemo(() => {
    const out: Record<string, { totalStrokes: number; totalPar: number; totalDelta: number; scoredHoles: number }> =
      {}
    for (const participantId of round.participantIds) {
      try {
        const protocol = normalizeScoreProtocol({
          version: round.scoreProtocolVersion,
          holeCount,
          holeScores: scoresByParticipant[participantId] ?? {},
        })
        const agg = aggregateScoreProtocol(protocol)
        out[participantId] = {
          totalStrokes: agg.totalStrokes,
          totalPar: agg.totalPar,
          totalDelta: agg.totalDelta,
          scoredHoles: agg.scoredHoles,
        }
      } catch {
        // Skip totals for participants whose scores cannot normalize.
      }
    }
    return out
  }, [holeCount, round.participantIds, round.scoreProtocolVersion, scoresByParticipant])

  const scrambleTeams = useMemo(
    () => normalizeRoundTeams(round.participantIds, round.teams),
    [round.participantIds, round.teams],
  )

  const isScramble = useMemo(
    () => isScrambleRound(round.participantIds, round),
    [round],
  )

  const readOnlyTotalRows = useMemo(() => {
    const gridRows = isScramble
      ? resolveScrambleGridRows({
          participantIds: round.participantIds,
          teams: scrambleTeams,
          participantNames,
        })
      : null
    if (gridRows) {
      return gridRows.map((row) => ({
        rowId: row.rowId,
        displayName: row.displayName,
        participantId: row.scoreParticipantId,
      }))
    }
    return round.participantIds.map((participantId) => ({
      rowId: participantId,
      displayName: participantNames[participantId] ?? participantId,
      participantId,
    }))
  }, [isScramble, participantNames, round.participantIds, scrambleTeams])

  const isRoundCompleted = round.completedAt !== null
  const resultUnits = useMemo(
    () =>
      buildRoundResultUnits({
        participantIds: round.participantIds,
        participantNames,
        teams: isScramble ? scrambleTeams : undefined,
      }),
    [isScramble, participantNames, round.participantIds, scrambleTeams],
  )
  const totalsByParticipant = useMemo(() => {
    const out: Record<string, { totalStrokes: number; totalPar: number; totalDelta: number; scoredHoles: number }> = {}
    for (const [participantId, summary] of Object.entries(totals)) {
      out[participantId] = summary
    }
    return out
  }, [totals])

  const courseLabel = deriveCourseLabel(round, t('scoring.rounds.unnamed'))
  const startedLabel = formatTimestamp(round.startedAt, i18n.language)
  const completedLabel = formatTimestamp(round.completedAt, i18n.language)

  return (
    <section className="scoring-panel" aria-labelledby="read-only-scorecard-title">
      <h2 id="read-only-scorecard-title" className="scoring-panel__title">
        {t('rounds.scorecard.readOnlyTitle', { courseName: courseLabel })}
      </h2>
      <p className="scoring-panel__muted">
        {completedLabel
          ? t('rounds.scorecard.readOnlyMetaCompleted', { startedAt: startedLabel, completedAt: completedLabel })
          : t('rounds.scorecard.readOnlyMetaStarted', { startedAt: startedLabel })}
      </p>
      {isRoundCompleted ? (
        <RoundResultsSummary units={resultUnits} totalsByParticipant={totalsByParticipant} />
      ) : null}
      <ScorecardSummaryGrid
        participantIds={round.participantIds}
        participantNames={participantNames}
        scoresByParticipant={scoresByParticipant}
        holeCount={holeCount}
        holeMetadataByNumber={holeMetadataByNumber}
        teams={isScrambleRound(round.participantIds, round) ? scrambleTeams : undefined}
      />
      <ul className="scoring-panel__read-only-totals" aria-label={t('rounds.scorecard.readOnlyTotalsAria')}>
        {readOnlyTotalRows.map((row) => {
          const summary = totals[row.participantId]
          if (!summary || summary.scoredHoles === 0) {
            return (
              <li key={row.rowId} className="scoring-panel__read-only-total">
                <span className="scoring-panel__read-only-total-name">{row.displayName}</span>
                <span className="scoring-panel__muted">{t('scoring.rounds.noScores')}</span>
              </li>
            )
          }
          return (
            <li key={row.rowId} className="scoring-panel__read-only-total">
              <span className="scoring-panel__read-only-total-name">{row.displayName}</span>
              <span className="scoring-panel__read-only-total-value">
                {t('scoring.participants.playerSummary', {
                  totalStrokes: summary.totalStrokes,
                  totalPar: summary.totalPar,
                  totalDelta: formatDelta(summary.totalDelta),
                  scoredHoles: summary.scoredHoles,
                })}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
