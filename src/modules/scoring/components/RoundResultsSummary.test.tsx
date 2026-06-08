import { renderToString } from 'react-dom/server'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it } from 'vitest'
import { i18n } from '@common/i18n'
import { RoundResultsSummary } from '@modules/scoring/components/RoundResultsSummary'

describe('RoundResultsSummary', () => {
  it('renders winner headline and standing lines when round has scores', () => {
    const html = renderToString(
      <I18nextProvider i18n={i18n}>
        <RoundResultsSummary
          units={[
            { id: 'a', displayName: 'The kings', scoreParticipantId: 'u1' },
            { id: 'b', displayName: 'BB', scoreParticipantId: 'u2' },
          ]}
          totalsByParticipant={{
            u1: { totalStrokes: 54, totalPar: 54, totalDelta: 0, scoredHoles: 18 },
            u2: { totalStrokes: 57, totalPar: 54, totalDelta: 3, scoredHoles: 18 },
          }}
        />
      </I18nextProvider>,
    )
    expect(html).toContain('round-results__winner')
    expect(html).toContain('The kings')
    expect(html).toContain('BB')
    expect(html).toContain('round-results__place--gold')
    expect(html).toContain('54')
    expect(html).toContain('+3')
  })
})
