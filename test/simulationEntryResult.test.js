import { describe, it, expect } from 'vitest';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import SimulationEntryResult from '../src/components/SimulationEntryResult.vue';
import { applySimulationCommission } from '../src/tradeSetupSimulationCosts.js';

describe('entry result beside DR conditions', () => {
  it('renders the matching variant and keeps unknown/open outcomes separate from losses', async () => {
    const snapshot = {id:'entry',runId:'current',entry:{recognizedAt:1788940200}};
    const base = {snapshotId:'entry',runId:'current',variant:'wide',lots:2,actualRisk:180,status:'closed',outcome:'slBeforeT1',pnlUsd:-180};
    const render = async (result, variant='wide') => renderToString(createSSRApp(SimulationEntryResult, {snapshot,variant,results:[applySimulationCommission({...base,runId:'other',pnlUsd:900}),applySimulationCommission(result)]}));
    const loss = await render(base);
    expect(loss).toContain('Verlust nach Kommission');
    expect(loss).toContain('-$190.00');
    expect(loss).not.toContain('$890.00');
    const unknown = await render({...base,status:'ambiguous',reason:'missingHistory',pnlUsd:null});
    expect(unknown).toContain('Uneindeutig');
    expect(unknown).toContain('Historie unvollständig');
    expect(unknown).not.toContain('Verlust nach Kommission');
    expect(unknown).not.toContain('-$10.00');
    const open = await render({...base,status:'open',pnlUsd:null,realizedPnlUsd:50});
    expect(open).toContain('Offen');
    expect(open).toContain('Bisher realisiert netto: $40.00');
    expect(open).not.toContain('Verlust nach Kommission');
    expect(await render({...base,variant:'narrow',pnlUsd:80},'narrow')).toContain('$70.00');
  });
});
