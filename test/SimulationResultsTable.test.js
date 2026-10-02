import { describe, it, expect } from 'vitest';
import { createSSRApp } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { renderToString } from 'vue/server-renderer';
import SimulationResultsTable from '../src/components/SimulationResultsTable.vue';
import { applySimulationCommission } from '../src/tradeSetupSimulationCosts.js';

async function render(rows) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }] });
  await router.push('/');
  await router.isReady();
  return renderToString(createSSRApp(SimulationResultsTable, { rows, runId: 'real-run' }).use(router));
}
const row = { entryId: 'entry:114', instrument: 'GBPUSD', direction: 'short', variant: 'narrow',
  entryTime: Date.parse('2026-09-09T09:50:00+02:00') / 1000, lots: 15, t1Lots: 7.5,
  actualRisk: 495, status: 'open', outcome: null, pnlUsd: null, rMultiple: null, realizedPnlUsd: 375 };

describe('simulation results table', () => {
  it('shows fractional half lots and realized gains without pretending an open position has finished', async () => {
    const html = await render([applySimulationCommission(row)]);
    expect(html).toContain('7,5');
    expect(html).toContain('$495.00');
    expect(html).toContain('$375.00');
    expect(html).toContain('$75.00');
    expect(html).toContain('$300.00');
    expect(html).toContain('Kommission USD');
    expect(html).toContain('Netto USD');
    expect(html).toContain('Offen');
    expect(html).toContain('2026-09-09 09:50');
    expect(html).toContain('setup2=entry:114&amp;run=real-run&amp;variant=narrow');
    expect(html.match(/>–</g)).toHaveLength(4);
  });
  it('limits rendered rows while reporting the full result count', async () => {
    const html = await render(Array.from({ length: 51 }, (_, i) => ({ ...row, entryId: `entry:${i}` })));
    expect(html).toContain('51 Ergebnisse · Seite 1 von 2');
    expect(html.match(/im Chart öffnen/g)).toHaveLength(50);
  });
  it('explains ambiguous outcomes in plain language', async () => {
    const html = await render([{ ...row, status: 'ambiguous', reason: 'sameCandle' }]);
    expect(html).toContain('Uneindeutig');
    expect(html).toContain('Reihenfolge innerhalb der Kerze unbekannt');
  });
  it('shows the saved sizing factor, reason and budget while labeling legacy rows', async () => {
    const html = await render([{ ...row, entrySizing: { factor: 0.5 }, riskBudget: 250 }, { ...row, entryId: 'legacy' }]);
    expect(html).toContain('Faktor 0,5');
    expect(html).toContain('kein bestätigter M5-CHoCH in Traderichtung');
    expect(html).toContain('$250.00');
    expect(html).toContain('Historischer Stand · bisherige Größe unverändert');
  });
});
