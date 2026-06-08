import type { RoundTeam } from '@core/domain/roundTeams'
import type { ParticipantTotals } from '@core/domain/scorecardTable'
import type { RoundDoc } from '@core/domain/round'
import { RoundResultsSummary } from '@modules/scoring/components/RoundResultsSummary'
import { ScorecardSummaryGrid } from '@modules/scoring/components/ScorecardSummaryGrid'
import type { RoundResultUnit } from '@modules/scoring/domain/buildRoundResultStandings'
import type { RoundHoleMetadata } from '@modules/scoring/domain/buildRoundHoleMetadata'
import { useTranslation } from 'react-i18next'

type Props = {
  selected: { data: RoundDoc } | null
  isRoundCompleted: boolean
  selectedResultUnits: RoundResultUnit[]
  selectedParticipantTotals: Record<string, ParticipantTotals>
  selectedParticipantNames: Record<string, string>
  selectedParticipantScores: Record<string, Record<string, { strokes: number; par: number }>> | null
  selectedHoleCount: number | null
  selectedHoleMetadataByNumber: Record<number, RoundHoleMetadata>
  isScrambleScoring: boolean
  selectedScrambleTeams: RoundTeam[]
}

export function ScoringPanelResultsTab({
  selected,
  isRoundCompleted,
  selectedResultUnits,
  selectedParticipantTotals,
  selectedParticipantNames,
  selectedParticipantScores,
  selectedHoleCount,
  selectedHoleMetadataByNumber,
  isScrambleScoring,
  selectedScrambleTeams,
}: Props) {
  const { t } = useTranslation('common')

  return (
    <div className="scoring-panel__section">
      <span className="scoring-panel__label">{t('scoring.sections.results')}</span>
      {!selected ? (
        <p className="scoring-panel__muted">{t('scoring.participants.selectRoundFirst')}</p>
      ) : (
        <>
          {isRoundCompleted ? (
            <RoundResultsSummary
              units={selectedResultUnits}
              totalsByParticipant={selectedParticipantTotals}
            />
          ) : null}
          <ScorecardSummaryGrid
            participantIds={selected.data.participantIds}
            participantNames={selectedParticipantNames}
            scoresByParticipant={selectedParticipantScores ?? {}}
            holeCount={selectedHoleCount ?? 0}
            holeMetadataByNumber={selectedHoleMetadataByNumber}
            teams={isScrambleScoring ? selectedScrambleTeams : undefined}
          />
        </>
      )}
    </div>
  )
}
