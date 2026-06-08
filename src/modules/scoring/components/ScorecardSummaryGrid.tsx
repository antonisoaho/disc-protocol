import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { RoundTeam } from '@core/domain/roundTeams'
import { resolveScrambleGridRows } from '@core/domain/scrambleScoring'
import { scoreTierToNotationClassName, strokesParDeltaToNotation } from '@modules/scoring/domain/scoreSemantic'
import { scoreTierLabel } from '@modules/scoring/domain/scoreTierI18n'
import { computeParticipantTotals, type ParticipantHoleScores } from '@core/domain/scorecardTable'
import { formatToParBadge } from '@modules/scoring/domain/formatToParBadge'
import type { RoundHoleMetadata } from '@modules/scoring/domain/buildRoundHoleMetadata'

type Props = {
  participantIds: string[]
  participantNames: Record<string, string>
  scoresByParticipant: ParticipantHoleScores
  holeCount: number
  holeMetadataByNumber?: Record<number, RoundHoleMetadata>
  teams?: RoundTeam[]
}

type DisplayRow = {
  rowId: string
  displayName: string
  scoreParticipantId: string
}

export function ScorecardSummaryGrid({
  participantIds,
  participantNames,
  scoresByParticipant,
  holeCount,
  holeMetadataByNumber,
  teams,
}: Props) {
  const { t } = useTranslation('common')

  const holes = useMemo(() => Array.from({ length: holeCount }, (_, i) => i + 1), [holeCount])

  const parByHole = useMemo(() => {
    const out: Record<number, number | null> = {}
    for (const h of holes) {
      const fromCourse = holeMetadataByNumber?.[h]?.par
      if (typeof fromCourse === 'number') {
        out[h] = fromCourse
        continue
      }
      let par: number | null = null
      for (const pid of participantIds) {
        const s = scoresByParticipant[pid]?.[String(h)]
        if (s && typeof s.par === 'number') {
          par = s.par
          break
        }
      }
      out[h] = par
    }
    return out
  }, [holeMetadataByNumber, holes, participantIds, scoresByParticipant])

  const lengthByHole = useMemo(() => {
    const out: Record<number, number | null> = {}
    for (const h of holes) {
      const lengthMeters = holeMetadataByNumber?.[h]?.lengthMeters
      out[h] = typeof lengthMeters === 'number' ? lengthMeters : null
    }
    return out
  }, [holeMetadataByNumber, holes])

  const totalsByParticipant = useMemo(
    () => computeParticipantTotals(participantIds, scoresByParticipant),
    [participantIds, scoresByParticipant],
  )

  const displayRows = useMemo((): DisplayRow[] => {
    const gridRows = resolveScrambleGridRows({
      participantIds,
      teams,
      participantNames,
    })
    if (gridRows) {
      return gridRows.map((row) => ({
        rowId: row.rowId,
        displayName: row.displayName,
        scoreParticipantId: row.scoreParticipantId,
      }))
    }
    return participantIds.map((participantId) => ({
      rowId: participantId,
      displayName: participantNames[participantId] ?? participantId,
      scoreParticipantId: participantId,
    }))
  }, [participantIds, participantNames, teams])

  const totalParSum = useMemo(() => {
    let sum = 0
    let n = 0
    for (const h of holes) {
      const p = parByHole[h]
      if (typeof p === 'number') {
        sum += p
        n += 1
      }
    }
    return n > 0 ? sum : null
  }, [holes, parByHole])

  const totalLengthSum = useMemo(() => {
    let sum = 0
    let n = 0
    for (const h of holes) {
      const lengthMeters = lengthByHole[h]
      if (typeof lengthMeters === 'number') {
        sum += lengthMeters
        n += 1
      }
    }
    return n > 0 ? sum : null
  }, [holes, lengthByHole])

  const nameColLabel = teams && teams.length > 0 ? t('scoring.summary.teamCol') : t('scoring.summary.playerCol')

  if (holeCount < 1) {
    return null
  }

  return (
    <div
      className="scorecard-summary-grid__scroll"
      role="region"
      aria-label={t('scoring.summary.aria')}
    >
      <table className="scorecard-summary-grid">
        <colgroup>
          <col className="scorecard-summary-grid__col-name" />
          {holes.map((h) => (
            <col key={h} className="scorecard-summary-grid__col-hole" />
          ))}
          <col className="scorecard-summary-grid__col-total" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="scorecard-summary-grid__corner">
              {nameColLabel}
            </th>
            {holes.map((h) => (
              <th key={h} scope="col" className="scorecard-summary-grid__hole-head">
                {h}
              </th>
            ))}
            <th scope="col" className="scorecard-summary-grid__total-head">
              {t('scoring.summary.totalAbbr')}
            </th>
          </tr>
          <tr className="scorecard-summary-grid__par-row">
            <th scope="row" className="scorecard-summary-grid__par-label">
              {t('scoring.summary.parRow')}
            </th>
            {holes.map((h) => (
              <td key={h} className="scorecard-summary-grid__par-cell">
                {parByHole[h] ?? '—'}
              </td>
            ))}
            <td className="scorecard-summary-grid__par-cell scorecard-summary-grid__par-cell--total">
              {totalParSum ?? '—'}
            </td>
          </tr>
          <tr className="scorecard-summary-grid__length-row">
            <th
              scope="row"
              className="scorecard-summary-grid__length-label"
              title={t('scoring.holeForm.lengthMeters')}
            >
              {t('scoring.summary.lengthCol')}
            </th>
            {holes.map((h) => (
              <td key={h} className="scorecard-summary-grid__length-cell">
                {lengthByHole[h] ?? '—'}
              </td>
            ))}
            <td className="scorecard-summary-grid__length-cell scorecard-summary-grid__length-cell--total">
              {totalLengthSum ?? '—'}
            </td>
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row) => {
            const totals = totalsByParticipant[row.scoreParticipantId]
            const badge = totals ? formatToParBadge(totals.totalDelta, totals.scoredHoles) : ''
            return (
              <tr key={row.rowId}>
                <th scope="row" className="scorecard-summary-grid__player-name">
                  <span className="scorecard-summary-grid__player-name-text">{row.displayName}</span>
                  {badge ? (
                    <span className="scorecard-summary-grid__to-par-badge">({badge})</span>
                  ) : null}
                </th>
                {holes.map((h) => {
                  const key = String(h)
                  const cell = scoresByParticipant[row.scoreParticipantId]?.[key]
                  if (!cell) {
                    return (
                      <td
                        key={h}
                        className="scorecard-summary-grid__stroke-cell scorecard-summary-grid__stroke-cell--empty"
                      >
                        —
                      </td>
                    )
                  }
                  const notation = strokesParDeltaToNotation(cell.strokes, cell.par)
                  const tierLabel = scoreTierLabel(t, notation.tier)
                  return (
                    <td
                      key={h}
                      className={`scorecard-summary-grid__stroke-cell ${scoreTierToNotationClassName(notation.tier)}`}
                      title={t('scoring.summary.cellTitle', {
                        strokes: cell.strokes,
                        par: cell.par,
                        label: tierLabel,
                        delta: notation.delta > 0 ? `+${notation.delta}` : `${notation.delta}`,
                      })}
                    >
                      {cell.strokes}
                    </td>
                  )
                })}
                <td className="scorecard-summary-grid__total-cell">
                  {totals && totals.scoredHoles > 0 ? totals.totalStrokes : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
