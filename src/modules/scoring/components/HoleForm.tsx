import type { FormEventHandler, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

type Props = {
  holeNumber: number
  parValue: string
  lengthValue: string
  onParChange: (value: string) => void
  onLengthChange: (value: string) => void
  disablePar?: boolean
  disableLength: boolean
  /** Shown only for dirty/error — not while saving or saved. */
  saveStatusLabel?: string
  saveFailed?: boolean
  onRetrySave?: () => void
  isSaving?: boolean
  onSubmit: FormEventHandler<HTMLFormElement>
  children: ReactNode
}

export function HoleForm({
  holeNumber,
  parValue,
  lengthValue,
  onParChange,
  onLengthChange,
  disablePar = false,
  disableLength,
  saveStatusLabel,
  saveFailed = false,
  onRetrySave,
  isSaving = false,
  onSubmit,
  children,
}: Props) {
  const { t } = useTranslation('common')

  return (
    <form
      className="scoring-panel__hole-form"
      aria-label={t('scoring.holeForm.sectionAria', { holeNumber })}
      aria-busy={isSaving}
      onSubmit={onSubmit}
    >
      <div className="scoring-panel__hole-meta-row">
        <label className="scoring-panel__field scoring-panel__field--compact field">
          <span className="scoring-panel__label field__label">{t('scoring.holeForm.par')}</span>
          <input
            className="scoring-panel__input field__control"
            type="number"
            min={2}
            max={9}
            step={1}
            value={parValue}
            onChange={(event) => onParChange(event.target.value)}
            aria-label={t('scoring.holeForm.parAria', { holeNumber })}
            disabled={disablePar || isSaving}
          />
        </label>
        <label className="scoring-panel__field scoring-panel__field--compact field">
          <span className="scoring-panel__label field__label">{t('scoring.holeForm.lengthMeters')}</span>
          <input
            className="scoring-panel__input field__control"
            type="number"
            min={1}
            max={5000}
            step={1}
            value={lengthValue}
            onChange={(event) => onLengthChange(event.target.value)}
            aria-label={t('scoring.holeForm.lengthAria', { holeNumber })}
            disabled={disableLength || isSaving}
          />
        </label>
      </div>
      {saveStatusLabel || (saveFailed && onRetrySave) ? (
      <div className="scoring-panel__save-status-row">
        {saveStatusLabel ? (
        <p className="scoring-panel__muted scoring-panel__save-status" role="status" aria-live="polite">
          {saveStatusLabel}
        </p>
        ) : null}
        {saveFailed && onRetrySave ? (
          <button
            type="button"
            className="scoring-panel__button scoring-panel__button--inline scoring-panel__retry-save"
            onClick={onRetrySave}
          >
            {t('scoring.buttons.retrySave')}
          </button>
        ) : null}
      </div>
      ) : null}
      {children}
    </form>
  )
}
