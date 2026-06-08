import type { FormEventHandler } from 'react'
import type { ParticipantTotals } from '@core/domain/scorecardTable'
import type { RoundDoc } from '@core/domain/round'
import type { RoundTeam } from '@core/domain/roundTeams'
import { HoleForm } from '@modules/scoring/components/HoleForm'
import { HoleStepper } from '@modules/scoring/components/HoleStepper'
import { PlayerScoreRows } from '@modules/scoring/components/PlayerScoreRows'
import { TeamScoreRows } from '@modules/scoring/components/TeamScoreRows'
import type { HoleDraftInputs } from '@modules/scoring/domain/holeAutosave'
import type { HoleSubmitMode } from '@modules/scoring/domain/holeSubmit'
import { formatScoringDelta, parseScoringIntegerInput } from '@modules/scoring/domain/scoringPanelFormat'
import { useTranslation } from 'react-i18next'

type RoundSummary = {
  totalStrokes: number
  totalPar: number
  totalDelta: number
}

type Props = {
  roundId: string
  canDeleteRound: boolean
  roundMissingAfterSync: boolean
  selected: { data: RoundDoc } | null
  selectedSummary: RoundSummary | null
  fullyScoredHoles: number
  selectedHoleCount: number | null
  activeHoleNumber: number
  leaveHole: (targetHoleNumber: number) => Promise<boolean>
  stepHoleNumber: (current: number, direction: -1 | 1, holeCount: number) => number
  controlsDisabled: boolean
  saveInProgress: boolean
  effectiveHoleDraft: HoleDraftInputs | null
  honorHint: string | null
  updateHoleDraft: (updater: (current: HoleDraftInputs) => HoleDraftInputs) => void
  savedCourseMetadataLocked: boolean
  holeFormSaveStatusLabel?: string
  saveFailed: boolean
  onRetrySave: () => void
  onSubmitHoleForm: FormEventHandler<HTMLFormElement>
  scrambleTeams: RoundTeam[] | undefined
  selectedParticipantNames: Record<string, string>
  selectedParticipantTotals: Record<string, ParticipantTotals>
  holeSubmitMode: HoleSubmitMode | null
  holeSubmitLabel: string
  canCompleteRound: boolean
  onCompleteWithSave: () => Promise<void>
  onRetryPromotion: () => void | Promise<void>
  onDeleteRound: (roundId: string, ownerId: string) => void | Promise<void>
}

export function ScoringPanelScorecardTab({
  roundId,
  canDeleteRound,
  roundMissingAfterSync,
  selected,
  selectedSummary,
  fullyScoredHoles,
  selectedHoleCount,
  activeHoleNumber,
  leaveHole,
  stepHoleNumber,
  controlsDisabled,
  saveInProgress,
  effectiveHoleDraft,
  honorHint,
  updateHoleDraft,
  savedCourseMetadataLocked,
  holeFormSaveStatusLabel,
  saveFailed,
  onRetrySave,
  onSubmitHoleForm,
  scrambleTeams,
  selectedParticipantNames,
  selectedParticipantTotals,
  holeSubmitMode,
  holeSubmitLabel,
  canCompleteRound,
  onCompleteWithSave,
  onRetryPromotion,
  onDeleteRound,
}: Props) {
  const { t } = useTranslation('common')

  return (
    <>
      {roundMissingAfterSync ? (
        <p className="scoring-panel__error" role="alert">
          {t('rounds.scorecard.notFoundOrNoAccess')}
        </p>
      ) : null}

      {selected ? (
        <div className="scoring-panel__section">
          {selectedSummary ? (
            <p className="scoring-panel__muted">
              {t('scoring.rounds.roundTotal', {
                totalStrokes: selectedSummary.totalStrokes,
                totalPar: selectedSummary.totalPar,
                totalDelta: formatScoringDelta(selectedSummary.totalDelta),
                fullyScoredHoles,
                holeCount: selectedHoleCount ?? 0,
              })}
            </p>
          ) : null}
          <HoleStepper
            key={`${roundId}:${activeHoleNumber}`}
            holeCount={selectedHoleCount ?? 1}
            currentHole={activeHoleNumber}
            onSelectHole={(nextHole) => void leaveHole(nextHole)}
            onPrevious={() => {
              if (!selectedHoleCount) return
              void leaveHole(stepHoleNumber(activeHoleNumber, -1, selectedHoleCount))
            }}
            onNext={() => {
              if (!selectedHoleCount) return
              void leaveHole(stepHoleNumber(activeHoleNumber, 1, selectedHoleCount))
            }}
            disabled={controlsDisabled || !effectiveHoleDraft}
            honorHint={honorHint}
          />
          {effectiveHoleDraft ? (
            <HoleForm
              holeNumber={activeHoleNumber}
              parValue={effectiveHoleDraft.parInput}
              lengthValue={effectiveHoleDraft.lengthInput}
              onParChange={(value) =>
                updateHoleDraft((current) => ({
                  ...current,
                  parInput: value,
                }))
              }
              onLengthChange={(value) =>
                updateHoleDraft((current) => ({
                  ...current,
                  lengthInput: value,
                }))
              }
              disablePar={savedCourseMetadataLocked}
              disableLength={
                selected.data.courseSource === 'fresh' ? false : savedCourseMetadataLocked
              }
              saveStatusLabel={holeFormSaveStatusLabel}
              saveFailed={saveFailed}
              isSaving={saveInProgress}
              onRetrySave={onRetrySave}
              onSubmit={onSubmitHoleForm}
            >
              <>
                {scrambleTeams ? (
                  <TeamScoreRows
                    participantIds={selected.data.participantIds}
                    teams={scrambleTeams}
                    participantNames={selectedParticipantNames}
                    scoreInputs={effectiveHoleDraft.scoreInputs}
                    onScoreInputsChange={(updater) =>
                      updateHoleDraft((current) => ({
                        ...current,
                        scoreInputs: updater(current.scoreInputs),
                      }))
                    }
                    parValue={parseScoringIntegerInput(effectiveHoleDraft.parInput)}
                    totalsByParticipant={selectedParticipantTotals}
                    disabled={controlsDisabled}
                  />
                ) : (
                  <PlayerScoreRows
                    participantIds={selected.data.participantIds}
                    participantNames={selectedParticipantNames}
                    scoreInputs={effectiveHoleDraft.scoreInputs}
                    onScoreChange={(participantUid, value) =>
                      updateHoleDraft((current) => ({
                        ...current,
                        scoreInputs: {
                          ...current.scoreInputs,
                          [participantUid]: value,
                        },
                      }))
                    }
                    parValue={parseScoringIntegerInput(effectiveHoleDraft.parInput)}
                    totalsByParticipant={selectedParticipantTotals}
                    disabled={controlsDisabled}
                  />
                )}
                {selectedHoleCount ? (
                  <div className="scoring-panel__next-hole-row">
                    <button
                      type="submit"
                      className="scoring-panel__button scoring-panel__button--primary scoring-panel__next-hole"
                      disabled={controlsDisabled || !effectiveHoleDraft || !holeSubmitMode}
                      aria-busy={saveInProgress}
                    >
                      {saveInProgress ? t('scoring.saveState.saving') : holeSubmitLabel}
                    </button>
                  </div>
                ) : null}
              </>
            </HoleForm>
          ) : (
            <p className="scoring-panel__muted">{t('scoring.rounds.selectRoundToLoadHoleForm')}</p>
          )}
          <div className="scoring-panel__row scoring-panel__row--end">
            {canCompleteRound && holeSubmitMode !== 'complete' ? (
              <button
                type="button"
                className="scoring-panel__button scoring-panel__button--primary"
                onClick={() => void onCompleteWithSave()}
                disabled={controlsDisabled}
              >
                {t('scoring.buttons.completeRound')}
              </button>
            ) : null}
            {selected.data.courseSource === 'fresh' &&
            (selected.data.coursePromotion?.status === 'pending' ||
              selected.data.coursePromotion?.status === 'failed') ? (
              <button
                type="button"
                className="scoring-panel__button"
                onClick={() => void onRetryPromotion()}
                disabled={controlsDisabled}
              >
                {t('scoring.buttons.retryPromotion')}
              </button>
            ) : null}
            {canDeleteRound ? (
              <button
                type="button"
                className="scoring-panel__button scoring-panel__button--danger"
                onClick={() => void onDeleteRound(roundId, selected.data.ownerId)}
                disabled={controlsDisabled}
              >
                {t('scoring.buttons.delete')}
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="scoring-panel__muted">{t('scoring.rounds.selectRoundToRecordScores')}</p>
      )}
    </>
  )
}
