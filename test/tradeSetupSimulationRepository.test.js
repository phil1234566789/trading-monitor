import { describe, it, expect, vi } from 'vitest';
import { createSimulationRepository, simulationAsOf } from '../src/tradeSetupSimulationRepository.js';

describe('simulation history repository', () => {
  it('reads exactly one linked entry with its uncut outcomes and snapshot', async () => {
    const query={select:vi.fn(()=>query),eq:vi.fn(()=>query),maybeSingle:vi.fn(async()=>({data:{id:'entry',
      instrument:'GBPUSD',direction:'short',snapshot:{id:'entry',setupKey:'setup'},
      outcomes:[{variant:'wide',exitRecognizedAt:600,status:'closed'}]}}))};
    const result=await createSimulationRepository({from:()=>query}).getEntry('run','entry');
    expect(query.eq.mock.calls).toEqual([['run_id','run'],['id','entry']]);
    expect(query.maybeSingle).toHaveBeenCalledTimes(1);
    expect(result.results[0]).toMatchObject({runId:'run',snapshotId:'entry',setupKey:'setup',status:'closed',exitRecognizedAt:600});
  });
  it('keeps the setup identity when reading entry outcomes for candidate deduplication', async () => {
    const query={select:()=>query,eq:()=>query,order:()=>query,
      range:async from=>({data:from?[]:[{id:'entry',setupKey:'candidate',instrument:'GBPUSD',direction:'short',
        outcomes:[{entryId:'entry',entryTime:300,variant:'wide',status:'open'}]}]})};
    const rows=await createSimulationRepository({from:()=>query}).listResults({runId:'run'});
    expect(rows[0]).toMatchObject({snapshotId:'entry',setupKey:'candidate',runId:'run'});
  });
  it('hides later exit and T1 facts from historical views', () => {
    const row = { entryTime: 120, evaluatedAt: 600, status: 'closed', outcome: 't2',
      t1Time: 180, t1RecognizedAt: 240, t1PnlUsd: 400, exitTime: 300, exitRecognizedAt: 360,
      pnlUsd: 1200, realizedPnlUsd: 1200, rMultiple: 2.5 };
    expect(simulationAsOf(row, 119)).toBeNull();
    expect(simulationAsOf(row, 180)).toMatchObject({ status: 'open', t1Time: null, t1PnlUsd: 0, realizedPnlUsd: 0, pnlUsd: null });
    expect(simulationAsOf(row, 240)).toMatchObject({ status: 'open', realizedPnlUsd: 400, pnlUsd: null });
    expect(simulationAsOf(row, 360)).toMatchObject({ status: 'closed', pnlUsd: 1200 });
  });
  it('dates ambiguity at its first evidence, independently of the run horizon', () => {
    const row = { entryTime: 120, evaluatedAt: 600, status: 'ambiguous', reason: 'sameCandle', ambiguityRecognizedAt: 240 };
    expect(simulationAsOf(row, 239)).toMatchObject({ status: 'open', reason: null, ambiguityRecognizedAt: null });
    expect(simulationAsOf(row, 240)).toMatchObject({ status: 'ambiguous', reason: 'sameCandle', ambiguityRecognizedAt: 240 });
    expect(simulationAsOf(row, 300).status).toBe('ambiguous');
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
