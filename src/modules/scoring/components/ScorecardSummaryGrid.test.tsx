import { renderToString } from 'react-dom/server'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it } from 'vitest'
import { i18n } from '@common/i18n'
import { ScorecardSummaryGrid } from '@modules/scoring/components/ScorecardSummaryGrid'

describe('ScorecardSummaryGrid', () => {
  it('renders table markup with player and stroke cells', () => {
    const html = renderToString(
      <I18nextProvider i18n={i18n}>
        <ScorecardSummaryGrid
          participantIds={['u1']}
          participantNames={{ u1: 'Player One' }}
          scoresByParticipant={{
            u1: {
              '1': { strokes: 3, par: 3 },
              '2': { strokes: 4, par: 3 },
            },
          }}
          holeCount={2}
          holeMetadataByNumber={{
            1: { par: 3, lengthMeters: 90 },
            2: { par: 3, lengthMeters: 100 },
          }}
        />
      </I18nextProvider>,
    )
    expect(html).toContain('scorecard-summary-grid')
    expect(html).toContain('scorecard-summary-grid__col-name')
    expect(html).toContain('Player One')
    expect(html).toContain('>3<')
    expect(html).toContain('>4<')
    expect(html).toContain('>90<')
    expect(html).toContain('>100<')
    expect(html).toContain('>190<')
    expect(html).toContain('scorecard-summary-grid__player-name-text')
    expect(html).toContain('scorecard-summary-grid__to-par-badge')
    expect(html).toContain('(+1)')
  })

  it('renders one row per team when scramble teams are configured', () => {
    const html = renderToString(
      <I18nextProvider i18n={i18n}>
        <ScorecardSummaryGrid
          participantIds={['u1', 'u2', 'u3']}
          participantNames={{ u1: 'A', u2: 'B', u3: 'C' }}
          scoresByParticipant={{
            u1: { '1': { strokes: 3, par: 3 } },
            u2: { '1': { strokes: 3, par: 3 } },
            u3: { '1': { strokes: 4, par: 3 } },
          }}
          holeCount={1}
          teams={[{ id: 'team:aaa', name: 'Eagles', participantIds: ['u1', 'u2'] }]}
        />
      </I18nextProvider>,
    )
    expect(html).not.toContain('scorecard-summary-grid--transposed')
    expect(html).toContain('Eagles')
    expect(html).not.toContain('>A<')
    expect(html).not.toContain('>B<')
    expect(html).toContain('C')
    expect(html).toContain('>3<')
    expect(html).toContain('>4<')
  })

  it('omits the to-par badge when no holes have been scored', () => {
    const html = renderToString(
      <I18nextProvider i18n={i18n}>
        <ScorecardSummaryGrid
          participantIds={['u1']}
          participantNames={{ u1: 'Player One' }}
          scoresByParticipant={{}}
          holeCount={2}
        />
      </I18nextProvider>,
    )
    expect(html).toContain('Player One')
    expect(html).not.toContain('scorecard-summary-grid__to-par-badge')
  })
})
