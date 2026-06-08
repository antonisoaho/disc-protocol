type Props = {
  label: string
}

export function ScoreRowStandingBadge({ label }: Props) {
  if (!label) {
    return null
  }
  return <span className="scoring-panel__player-row-standing">({label})</span>
}
