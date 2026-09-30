import { describe, it, expect, vi } from 'vitest';
import { createSimulationRepository, simulationAsOf } from '../src/tradeSetupSimulationRepository.js';

describe('simulation history repository', () => {
  it('hides later exit and T1 facts from historical views', () => {
    const row = { entryTime: 120, evaluatedAt: 600, status: 'closed', outcome: 't2',
      t1Time: 180, t1RecognizedAt: 240, t1PnlUsd: 400, exitTime: 300, exitRecognizedAt: 360,
      pnlUsd: 1200, realizedPnlUsd: 1200, rMultiple: 2.5 };
    expect(simulationAsOf(row, 119)).toBeNull();
    expect(simulationAsOf(row, 180)).toMatchObject({ status: 'open', t1Time: null, realizedPnlUsd: 0, pnlUsd: null });
    expect(simulationAsOf(row, 240)).toMatchObject({ status: 'open', realizedPnlUsd: 400, pnlUsd: null });
    expect(simulationAsOf(row, 360)).toMatchObject({ status: 'closed', pnlUsd: 1200 });
  });
  it('continues pagination after a short server-capped page', async () => {
    const offsets = [];
    const query = { select: () => query, order: () => query,
      range: async start => { offsets.push(start); return { data: start < 4 ? [{ run: { id: start } }, { run: { id: start + 1 } }] : [], error: null }; } };
    const rows = await createSimulationRepository({ from: () => query }).listRuns();
    expect(rows.map(r => r.id)).toEqual([0, 1, 2, 3]);
    expect(offsets).toEqual([0, 2, 4]);
  });
  it('batches writes and propagates a failure', async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: new Error('failed') });
    await expect(createSimulationRepository({ rpc }).saveEntries('run', Array.from({ length: 101 }, () => ({})))).rejects.toThrow('failed');
    expect(rpc.mock.calls[0][1].records).toHaveLength(100);
    expect(rpc.mock.calls[1][1].records).toHaveLength(1);
  });
});
