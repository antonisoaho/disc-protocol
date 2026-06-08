import { renderToString } from 'react-dom/server'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it } from 'vitest'
import { i18n } from '@common/i18n'
import { TeamScoreRows } from '@modules/scoring/components/TeamScoreRows'

describe('TeamScoreRows', () => {
  it('shows relative standing badge on team rows', () => {
    const html = renderToString(
      <I18nextProvider i18n={i18n}>
        <TeamScoreRows
          participantIds={['u1', 'u2']}
          teams={[{ id: 'team:a', name: 'The kings', participantIds: ['u1', 'u2'] }]}
          participantNames={{ u1: 'Alice', u2: 'Bob' }}
          scoreInputs={{ u1: '', u2: '' }}
          onScoreInputsChange={() => {}}
          parValue={3}
          totalsByParticipant={{
            u1: { totalStrokes: 10, totalPar: 9, totalDelta: 1, scoredHoles: 3 },
            u2: { totalStrokes: 10, totalPar: 9, totalDelta: 1, scoredHoles: 3 },
          }}
        />
      </I18nextProvider>,
    )

    expect(html).toContain('The kings')
    expect(html).toContain('scoring-panel__player-row-name-text')
    expect(html).toContain('scoring-panel__player-row-standing')
    expect(html).toContain('>L<')
  })
})
