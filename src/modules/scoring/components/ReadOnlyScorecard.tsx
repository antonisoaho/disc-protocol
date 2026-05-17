import type { Timestamp } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { RoundDoc, RoundAnonymousParticipant } from '@core/domain/round'
import { inferRoundHoleCount } from '@core/domain/inferRoundHoleCount'
import { aggregateScoreProtocol, normalizeScoreProtocol } from '@core/domain/scoreProtocol'
import { buildAnonymousParticipantNameMap } from '@core/domain/participantRoster'
import { subscribeUserDirectory, type UserDirectoryEntry } from '@core/users/userDirectory'
import { ScorecardSummaryGrid } from '@modules/scoring/components/ScorecardSummaryGrid'

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

  useEffect(() => {
    const unsub = subscribeUserDirectory(
      (entries) => setDirectoryEntries(entries),
      () => {},
    )
    return () => unsub()
  }, [])

  const holeCount = useMemo(() => inferRoundHoleCount(round) ?? 0, [round])
  const scoresByParticipant = useMemo(() => readParticipantHoleScores(round), [round])
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
      <p className="scoring-panel__muted scoring-panel__summary-caption">{t('scoring.summary.caption')}</p>
      <ScorecardSummaryGrid
        participantIds={round.participantIds}
        participantNames={participantNames}
        scoresByParticipant={scoresByParticipant}
        holeCount={holeCount}
      />
      <ul className="scoring-panel__read-only-totals" aria-label={t('rounds.scorecard.readOnlyTotalsAria')}>
        {round.participantIds.map((participantId) => {
          const summary = totals[participantId]
          const name = participantNames[participantId] ?? participantId
          if (!summary || summary.scoredHoles === 0) {
            return (
              <li key={participantId} className="scoring-panel__read-only-total">
                <span className="scoring-panel__read-only-total-name">{name}</span>
                <span className="scoring-panel__muted">{t('scoring.rounds.noScores')}</span>
              </li>
            )
          }
          return (
            <li key={participantId} className="scoring-panel__read-only-total">
              <span className="scoring-panel__read-only-total-name">{name}</span>
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
