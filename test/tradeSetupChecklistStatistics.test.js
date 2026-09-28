import { describe, it, expect } from 'vitest';
import { createChecklistStatisticsStore, checklistStatisticsConfiguration, checklistConfigurationKey } from '../src/tradeSetupChecklistStatistics.js';

const selection = { status: 'passed', selectedAt: 600, direction: 'short', target1: { price: 8 }, target2: { price: 6 } };
const record = id => ({ candidate_id: id, selection, invalidation: 12, source: {} });
const candles = [{ time: 600, low: 8, high: 10 }, { time: 900, low: 6, high: 10 }];
const result = (candidates = []) => ({ status: 'ready', instrument: 'GBPUSD', evaluatedAt: 1200, setup: { candidates }, context: { m5Candles: candles } });
function database(records = []) {
  const writes = [], offsets = [];
  return { writes, offsets, from() {
    const query = { select: () => query, eq: () => query, lte: () => query, order: () => query,
      range: async offset => { offsets.push(offset); return { data: records.slice(offset, offset + 2) }; } };
    return query;
  }, async rpc(name, args) { writes.push(...args.observations); return { error: null }; } };
}
describe('separate durable target statistics', () => {
  it('continues T2 for a stored candidate no longer in the current H1 tree', async () => {
    const db = database([record('old')]);
    await createChecklistStatisticsStore(db).save(result(), {}, []);
    expect(db.writes[0]).toMatchObject({ candidate_id: 'old', selected_at: 600,
      observation: { main: { reason: 'target1' }, target2: { status: 'reached', hitAt: 900 } } });
  });
  it('paginates by actual count and writes a candidate once per evaluation', async () => {
    const db = database([record('a'), record('b'), record('c')]);
    await createChecklistStatisticsStore(db).save(result([{ id: 'a', targetSelection: selection, invalidation: 12 }]), {}, []);
    expect(db.offsets).toEqual([0, 2, 3]);
    expect(db.writes.map(r => r.candidate_id)).toEqual(['a', 'b', 'c']);
  });
  it('keeps the originally saved selection instead of a changed modern reconstruction', async () => {
    const db = database([record('a')]);
    await createChecklistStatisticsStore(db).save(result([{ id: 'a', invalidation: 12,
      targetSelection: { ...selection, target2: { price: 5 } } }]), {}, []);
    expect(db.writes[0].selection).toEqual(selection);
  });
  it('returns errors and does not claim a failed save succeeded', async () => {
    const db = database([record('a')]);
    db.rpc = async () => ({ error: new Error('offline') });
    await expect(createChecklistStatisticsStore(db).save(result(), {}, [])).rejects.toThrow('offline');
  });
  it('distinguishes rule inputs while ignoring cosmetic session changes', async () => {
    const sessions = [{ instrument: 'GBPUSD', label: 'Asia', fromMinutes: 0, toMinutes: 420, highLowRelevant: true, color: 'red' }];
    const a = checklistStatisticsConfiguration({}, sessions, 'GBPUSD');
    const b = checklistStatisticsConfiguration({}, [{ ...sessions[0], color: 'blue' }], 'GBPUSD');
    expect(await checklistConfigurationKey(a)).toBe(await checklistConfigurationKey(b));
    expect(await checklistConfigurationKey(a)).not.toBe(await checklistConfigurationKey({ ...a, rangesPeriod: 7 }));
  });
});
