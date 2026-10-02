import { expect, it, vi } from 'vitest';
import { computed, effectScope, reactive, ref, nextTick } from 'vue';
vi.mock('../src/supabaseClient.js', () => ({ supabase: {} }));
import { createSnapshotM1Reader, snapshotEvidenceVisible } from '../src/tradeSetup2SnapshotIndicators.js';
import { useSnapshotM1 } from '../src/composables/useSnapshotM1.js';
import { SETUP2_VERSION } from '../src/tradeSetup2Configuration.js';
import { buildM1Structure } from '../src/m1Structure.js';

const candles = Array.from({ length: 60 }, (_, i) => ({ time: i * 60,
  open: 10, close: 10 + Math.sin(i), high: 11 + Math.sin(i), low: 9 + Math.sin(i) }));
const anchor = { pivotTime: 600, price: 10, recognizedAt: 900 };
const snapshot = () => ({ id: 'entry', instrument: 'GBPUSD', knownAt: 1800, entry: { price: 10 },
  checklist: { status: 'ready', instrument: 'GBPUSD', setup: { primary: { id: 'setup' } },
    checks: { h1Trend: { status: 'passed' }, liquiditySweep: { status: 'passed' }, reaction: { status: 'passed' }, m5Trend: { m1Anchor: anchor } } } });
const configuration = () => ({ instrument: 'GBPUSD', setupVersion: SETUP2_VERSION, m1Period: 5, sessions: [] });
const repository = configuration => ({ getRun: vi.fn(async () => ({ configuration })) });
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); await nextTick(); };

it('shares a bounded read and fixes all reconstructed pivots to knownAt without changing the snapshot', async () => {
  const source = snapshot(), before = JSON.stringify(source), db = repository({ instruments: [configuration()] });
  const fetch = vi.fn(async () => candles), read = createSnapshotM1Reader(db, fetch);
  const a = read('run', source), b = read('run', source);
  expect(a).toBe(b);
  const loaded = await a;
  expect(loaded.result).toEqual(buildM1Structure(candles.filter(c => c.time < 1800), anchor, 1800));
  expect(fetch).toHaveBeenCalledExactlyOnceWith('GBPUSD', 151, 1800);
  expect(db.getRun).toHaveBeenCalledTimes(1);
  expect(await read('run', source)).toBe(loaded);
  expect(JSON.stringify(source)).toBe(before);
});

it('declines incompatible versions, unconfirmed candidates, oversized windows and incomplete archives', async () => {
  const fetch = vi.fn(async () => candles.slice(12, 29));
  const source = snapshot();
  for (const config of [{}, { ...configuration(), setupVersion: 'legacy' }, { ...configuration(), sessions: undefined }]) {
    expect((await createSnapshotM1Reader(repository(config), fetch)('r', source)).result).toBeNull();
  }
  source.checklist.checks.reaction.status = 'pending';
  expect((await createSnapshotM1Reader(repository(configuration()), fetch)('r', source)).message).toContain('Anker');
  source.checklist.checks.reaction.status = 'passed'; source.knownAt = 1e6;
  expect((await createSnapshotM1Reader(repository(configuration()), fetch)('r', source)).message).toContain('Archivfenster');
  expect(fetch).not.toHaveBeenCalled();
  source.knownAt = 1800;
  expect((await createSnapshotM1Reader(repository(configuration()), fetch)('r', source)).message).toContain('unvollständig');
  expect((await createSnapshotM1Reader(repository(configuration()), async () => candles.filter(c => c.time !== 1200))('r', source)).message).toContain('unterbrochenes');
});

it('applies stored ignored sessions before building the structure', async () => {
  const config = configuration();
  config.sessions = [{ instrument: 'GBPUSD', days: [4], fromMinutes: 60, toMinutes: 90, ignoreLiquidity: true }];
  const loaded = await createSnapshotM1Reader(repository(config), async () => candles)('r', snapshot());
  expect(loaded.result).toBeNull();
  expect(loaded.message).toContain('unvollständig');
});

it('loads only on demand, discards late replay/selection results and reuses the request on re-toggle', async () => {
  let release;
  const fetch = vi.fn(() => new Promise(resolve => { release = resolve; }));
  const props = reactive({ showM1Structure: false, showLiquidityDebug: false, tradeSetup2RunId: 'r', currentBar: '5m' });
  const selected = ref(snapshot()), horizon = ref(1800);
  const visible = computed(() => selected.value?.knownAt <= horizon.value ? selected.value : null);
  const scope = effectScope();
  const state = scope.run(() => useSnapshotM1(props, visible, repository(configuration()), fetch));
  try {
    await flush(); expect(fetch).not.toHaveBeenCalled();
    props.showM1Structure = true; await flush();
    expect(fetch).not.toHaveBeenCalled();
    props.showLiquidityDebug = true; await flush();
    horizon.value = 1799; await flush(); release(candles); await flush();
    expect(state.value.result).toBeNull(); expect(state.value.message).toBe('');
    horizon.value = 1800; await flush(); expect(state.value.result.status).toBe('ready');
    props.showM1Structure = false; await flush(); expect(state.value.result).toBeNull();
    props.showM1Structure = true; await flush();
    horizon.value = 2100; await flush();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(state.value.result).toEqual(buildM1Structure(candles, anchor, 1800));
    selected.value = null; await flush(); expect(state.value.result).toBeNull();
  } finally { scope.stop(); }
});

it('filters only the relevant stored evidence without replacing saved structure', () => {
  for (const [role, timeframe, prop] of [['sweep', '1h', 'showLiquidity'], ['reactionOB', '5m', 'showObsM5'],
    ['structure', '1h', 'showRanges'], ['CHoCH', '5m', 'showM5Structure'], ['fvg', '1m', 'showM1Structure']]) {
    expect(snapshotEvidenceVisible({ role, timeframe }, { [prop]: false })).toBe(false);
    expect(snapshotEvidenceVisible({ role, timeframe }, { [prop]: true })).toBe(true);
  }
  expect(snapshotEvidenceVisible({ role: 'divergence' }, { showRsiDivergence: false, showRsiDivergenceHistory: false })).toBe(false);
  expect(snapshotEvidenceVisible({ role: 'structure', timeframe: '1m' }, {})).toBe(true);
  expect(snapshotEvidenceVisible({ role: 'fvg', timeframe: '1m' }, {})).toBe(true);
});
