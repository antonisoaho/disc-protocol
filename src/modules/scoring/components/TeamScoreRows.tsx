import type { ParticipantTotals } from '@core/domain/scorecardTable'
import type { RoundTeam } from '@core/domain/roundTeams'
import { applyTeamScoreInput, readTeamScoreInput, resolveScrambleScoringUnits } from '@core/domain/scrambleScoring'
import { ScoreRowStandingBadge } from '@modules/scoring/components/ScoreRowStandingBadge'
import { computeRelativeStandingById } from '@modules/scoring/domain/scoreRowStanding'
import { scoreTierToNotationClassName, strokesParDeltaToNotation } from '@modules/scoring/domain/scoreSemantic'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { scoreTierLabel } from '@modules/scoring/domain/scoreTierI18n'

const EMPTY_TOTALS_BY_PARTICIPANT: Record<string, ParticipantTotals> = {}

type Props = {
  participantIds: string[]
  teams: RoundTeam[]
  participantNames: Record<string, string>
  scoreInputs: Record<string, string>
  onScoreInputsChange: (updater: (current: Record<string, string>) => Record<string, string>) => void
  parValue: number | null
  totalsByParticipant?: Record<string, ParticipantTotals>
  disabled?: boolean
}

function parseIntegerInput(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null
  return Number(value)
}

export function TeamScoreRows({
  participantIds,
  teams,
  participantNames,
  scoreInputs,
  onScoreInputsChange,
  parValue,
  totalsByParticipant = EMPTY_TOTALS_BY_PARTICIPANT,
  disabled = false,
}: Props) {
  const { t } = useTranslation('common')
  const units = resolveScrambleScoringUnits({ participantIds, teams, participantNames })

  const standingByUnitId = useMemo(
    () =>
      computeRelativeStandingById(
        units.map((unit) => {
          if (unit.kind === 'team') {
            return {
              id: unit.teamId,
              totals: totalsByParticipant[unit.participantIds[0]],
            }
          }
          return {
            id: unit.participantId,
            totals: totalsByParticipant[unit.participantId],
          }
        }),
      ),
    [totalsByParticipant, units],
  )

  return (
    <div className="scoring-panel__player-rows" role="list" aria-label={t('scoring.teamRows.listAria')}>
      {units.map((unit) => {
        if (unit.kind === 'solo') {
          const displayName = unit.name
          const inputValue = scoreInputs[unit.participantId] ?? ''
          const parsedScore = parseIntegerInput(inputValue)
          const notation =
            parsedScore !== null && typeof parValue === 'number'
              ? strokesParDeltaToNotation(parsedScore, parValue)
              : null
          const notationTitleLabel = notation ? scoreTierLabel(t, notation.tier) : null
          const shellTierClass =
            notation && parsedScore !== null ? scoreTierToNotationClassName(notation.tier) : ''
          const deltaText =
            notation && parsedScore !== null
              ? notation.delta > 0
                ? `+${notation.delta}`
                : `${notation.delta}`
              : null
          const inputTitle =
            notation && notationTitleLabel && deltaText !== null
              ? `${notationTitleLabel} (${deltaText})`
              : typeof parValue !== 'number'
                ? t('scoring.playerRows.needParForResult')
                : undefined

          return (
            <div
              key={unit.participantId}
              className="scoring-panel__player-row scoring-panel__player-row--compact"
              role="listitem"
            >
              <span className="scoring-panel__player-row-name scoring-panel__player-row-name--compact">
                <span className="scoring-panel__player-row-name-text">{displayName}</span>
                <ScoreRowStandingBadge label={standingByUnitId[unit.participantId] ?? ''} />
              </span>
              <div className="scoring-panel__player-score-control">
                <div className={`scoring-panel__player-score-input-shell ${shellTierClass}`.trim()}>
                  <input
                    className="scoring-panel__player-score-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={2}
                    autoComplete="off"
                    value={inputValue}
                    title={inputTitle}
                    onChange={(event) =>
                      onScoreInputsChange((current) => ({
                        ...current,
                        [unit.participantId]: event.target.value.replace(/\D/g, '').slice(0, 2),
                      }))
                    }
                    disabled={disabled}
                    aria-label={t('scoring.playerRows.strokesForPlayerAria', { displayName })}
                  />
                </div>
              </div>
            </div>
          )
        }

        const team: RoundTeam = {
          id: unit.teamId,
          name: unit.name,
          participantIds: unit.participantIds,
        }
        const memberNames = unit.participantIds
          .map((participantId) => participantNames[participantId] ?? participantId)
          .join(', ')
        const inputValue = readTeamScoreInput(team, scoreInputs)
        const parsedScore = parseIntegerInput(inputValue)
        const notation =
          parsedScore !== null && typeof parValue === 'number'
            ? strokesParDeltaToNotation(parsedScore, parValue)
            : null
        const notationTitleLabel = notation ? scoreTierLabel(t, notation.tier) : null
        const shellTierClass =
          notation && parsedScore !== null ? scoreTierToNotationClassName(notation.tier) : ''
        const deltaText =
          notation && parsedScore !== null
            ? notation.delta > 0
              ? `+${notation.delta}`
              : `${notation.delta}`
            : null
        const inputTitle =
          notation && notationTitleLabel && deltaText !== null
            ? `${notationTitleLabel} (${deltaText})`
            : typeof parValue !== 'number'
              ? t('scoring.playerRows.needParForResult')
              : undefined

        return (
          <div
            key={unit.teamId}
            className="scoring-panel__player-row scoring-panel__player-row--compact"
            role="listitem"
          >
            <span className="scoring-panel__player-row-name scoring-panel__player-row-name--compact scoring-panel__player-row-name--team">
              <span className="scoring-panel__player-row-name-heading">
                <span className="scoring-panel__player-row-name-text">{unit.name}</span>
                <ScoreRowStandingBadge label={standingByUnitId[unit.teamId] ?? ''} />
              </span>
              <span className="scoring-panel__player-row-members">{memberNames}</span>
            </span>
            <div className="scoring-panel__player-score-control">
              <div className={`scoring-panel__player-score-input-shell ${shellTierClass}`.trim()}>
                <input
                  className="scoring-panel__player-score-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={2}
                  autoComplete="off"
                  value={inputValue}
                  title={inputTitle}
                  onChange={(event) =>
                    onScoreInputsChange((current) =>
                      applyTeamScoreInput(
                        team,
                        event.target.value.replace(/\D/g, '').slice(0, 2),
                        current,
                      ),
                    )
                  }
                  disabled={disabled}
                  aria-label={t('scoring.teamRows.strokesForTeamAria', { teamName: unit.name })}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
