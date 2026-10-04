import { expect, it, vi } from 'vitest';
import { effectScope, reactive, shallowRef, nextTick } from 'vue';
vi.mock('../src/supabaseClient.js', () => ({ supabase: {} }));
vi.mock('../src/snapshotIndicatorBrowser.js', async () => {
  const { calculateSnapshotIndicators } = await import('../src/snapshotIndicatorCalculation.js');
  return { calculateSnapshotIndicatorsInWorker: vi.fn(async input => calculateSnapshotIndicators(input)) };
});
import { useSnapshotIndicators } from '../src/composables/useSnapshotIndicators.js';
import { SETUP2_VERSION } from '../src/tradeSetup2Configuration.js';
import { snapshotChartCandleCount, snapshotStructureLevels } from '../src/tradeSetup2SnapshotIndicators.js';
import { buildSnapshotM5 } from '../src/tradeSetup2SnapshotIndicators.js';
import { calculateSnapshotIndicatorsInWorker } from '../src/snapshotIndicatorBrowser.js';
const flush = async () => { for (let i = 0; i < 12; i++) await nextTick(); };

it('reconstructs H1 structure on demand and removes it immediately when switched off',async()=>{
  const at=60*3600,source=shallowRef({instrument:'GBPUSD',knownAt:at});
  const props=reactive({tradeSetup2RunId:'r',currentBar:'5m',showRanges:false});
  const rows=Array.from({length:60},(_,i)=>({time:i*3600,open:10,close:10,
    high:11+Math.sin(i/2),low:9+Math.sin(i/2)}));
  const fetch=vi.fn(async()=>rows),scope=effectScope();
  const state=scope.run(()=>useSnapshotIndicators(props,source,{getRun:async()=>({configuration:{
    instrument:'GBPUSD',setupVersion:SETUP2_VERSION,sessions:[],rangesPeriod:5,ranges2Period:2}})},fetch));
  try {
    await flush();expect(fetch).not.toHaveBeenCalled();
    props.showRanges=true;await flush();
    expect(fetch).toHaveBeenCalledExactlyOnceWith('GBPUSD','1h',at,1000);
    expect(state.value.h1.state).toBeTruthy();expect(state.value.h1.pivotsOuter.length).toBeGreaterThan(0);
    props.showRanges=false;expect(state.value.h1).toBeUndefined();
  }finally{scope.stop();}
});

it('cancels the pending overlay on deselection and discards its late answer', async () => {
  let resolve;
  calculateSnapshotIndicatorsInWorker.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const source = shallowRef({ instrument: 'GBPUSD', knownAt: 1200 });
  const props = reactive({ tradeSetup2RunId: 'r', currentBar: '5m', showObsM5: true });
  const scope = effectScope();
  const state = scope.run(() => useSnapshotIndicators(props, source, { getRun: async () => ({ configuration: {
    instrument: 'GBPUSD', setupVersion: SETUP2_VERSION, sessions: [] } }) },
  async () => [{ time: 900, high: 1, low: 1, open: 1, close: 1 }]));
  try {
    await flush();
    const { signal } = calculateSnapshotIndicatorsInWorker.mock.calls.at(-1)[1];
    expect(signal.aborted).toBe(false);
    source.value = null;
    expect(signal.aborted).toBe(true);
    resolve({ zones: ['stale'], pivots: {}, m5: null });
    await flush();
    expect(state.value).toEqual({ zones: [], pivots: {}, message: '' });
  } finally { scope.stop(); }
});

it('advances M5 structure and confirmed debug pivots through closed replay prefixes, then rewinds',async()=>{
  const candles=Array.from({length:60},(_,i)=>({time:i*300,open:10,close:10+Math.sin(i/2),high:11+Math.sin(i/2),low:9+Math.sin(i/2)}));
  const stored={instrument:'GBPUSD',knownAt:6000,checklist:{checks:{m5Trend:{structureStart:1200}}}};
  const before=JSON.stringify(stored), source=shallowRef(stored);
  const config={instrument:'GBPUSD',setupVersion:SETUP2_VERSION,sessions:[],m5StructurePeriod:5,m5Structure2Period:2};
  const props=reactive({tradeSetup2RunId:'r',currentBar:'5m',showM5Structure:true,replayUntil:6000});
  const fetch=vi.fn(async()=>candles), scope=effectScope();
  const state=scope.run(()=>useSnapshotIndicators(props,source,{getRun:async()=>({configuration:config})},fetch));
  try {
    await flush(); const early=state.value.m5;
    props.replayUntil=12000; await new Promise(done=>setTimeout(done,180));await flush();
    expect(state.value.m5).toEqual(buildSnapshotM5(candles,stored,config,12000));
    expect(state.value.m5.pivotsOuter.length).toBeGreaterThan(early.pivotsOuter.length);
    expect(state.value.message).toContain('Replay');expect(state.value.message).toContain('Checklist');
    props.replayUntil=6000; await new Promise(done=>setTimeout(done,180));await flush();expect(state.value.m5).toEqual(early);
    expect(fetch).toHaveBeenCalledTimes(2);expect(JSON.stringify(stored)).toBe(before);
  }finally{scope.stop();}
});

it('restores OBs and raw pivots only from closed archive candles, sharing requests across switches', async () => {
  const at = 1790338500, source = shallowRef({ instrument: 'GBPUSD', knownAt: at });
  const props = reactive({ tradeSetup2RunId: 'r', currentBar: '5m', showObsM5: true,
    showM5Structure: true, showLiquidityDebug: true, showHistoricalObs: true });
  const candles = Array.from({ length: 20 }, (_, i) => ({ time: at - (20 - i) * 300,
    open: 1.3, close: 1.3, high: i === 10 ? 1.302 : 1.301, low: 1.299 }));
  candles.push({ time: at - 60, open: 1.31, close: 1.31, high: 1.32, low: 1.31 });
  const fetch = vi.fn(async () => candles);
  const repository = { getRun: vi.fn(async () => ({ configuration: { instrument: 'GBPUSD',
    setupVersion: SETUP2_VERSION, sessions: [], m5StructurePeriod: 5, m5Structure2Period: 2 } })) };
  const scope = effectScope(), state = scope.run(() => useSnapshotIndicators(props, source, repository, fetch));
  try {
    await flush();
    expect(fetch).toHaveBeenCalledWith('GBPUSD', '5m', at, 1000);
    expect(state.value.pivots['5m'].pivotsOuter).toContainEqual(expect.objectContaining({ price: 1.302 }));
    expect(state.value.zones).toEqual([]); // Die noch offene Zukunftskerze darf keinen OB erzeugen.
    props.showObsM5 = props.showM5Structure = false; await flush();
    expect(state.value.pivots).toEqual({});
    props.showObsM5 = props.showM5Structure = true; await flush();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(repository.getRun).toHaveBeenCalledTimes(1);
    props.currentBar = '1h'; await flush();
    expect(state.value.zones).toEqual([]);
  } finally { scope.stop(); }
});

it('does not overwrite a new selection with an old archive answer', async () => {
  let resolve;
  const pending = new Promise(done => { resolve = done; });
  const source = shallowRef({ instrument: 'GBPUSD', knownAt: 6000 });
  const props = reactive({ tradeSetup2RunId: 'r', currentBar: '5m', showObsM5: true });
  const repository = { getRun: async () => ({ configuration: { instrument: 'GBPUSD', setupVersion: SETUP2_VERSION, sessions: [] } }) };
  const scope = effectScope(), state = scope.run(() => useSnapshotIndicators(props, source, repository, () => pending));
  try {
    await flush(); source.value = null; await flush();
    resolve([{ time: 5700, open: 1, close: 1, high: 1, low: 1 }]); await flush();
    expect(state.value).toEqual({ zones: [], pivots: {}, message: '' });
  } finally { scope.stop(); }
});

it('recreates a closed M5 order block and honors its switch', async () => {
  const at = 1200, props = reactive({ tradeSetup2RunId: 'r', currentBar: '5m', showObsM5: true });
  const source = shallowRef({ instrument: 'GBPUSD', knownAt: at });
  const rows = [
    { time: 0, open: 1.2999, high: 1.3, low: 1.2998, close: 1.29995 },
    { time: 300, open: 1.29995, high: 1.3, low: 1.2999, close: 1.3 },
    { time: 600, open: 1.3, high: 1.30005, low: 1.29998, close: 1.30002 },
    { time: 900, open: 1.30002, high: 1.30028, low: 1.3002, close: 1.30026 },
  ];
  const repository = { getRun: async () => ({ configuration: { instrument: 'GBPUSD', setupVersion: SETUP2_VERSION, sessions: [] } }) };
  const scope = effectScope(), state = scope.run(() => useSnapshotIndicators(props, source, repository, async () => rows));
  try {
    await flush();
    expect(state.value.zones).toEqual([expect.objectContaining({ timeframe: '5M', dir: 1, startTime: 600 })]);
    props.showObsM5 = false; await flush();
    expect(state.value.zones).toEqual([]);
  } finally { scope.stop(); }
});

it('preserves saved structure prices and sweep endpoints without reading later chart bars', () => {
  const high = { type: 'high', price: 2, pivotTime: 100 };
  const low = { type: 'low', price: 1, pivotTime: 200 };
  const sweep = { type: 'LQ-sweep', price: 1.5, pivotTime: 300, touched: { touchedTime: 500 } };
  const snapshot = { knownAt: 900, checklist: { structure: { trend: 'uptrend', currRange: { high, low }, structurePivots: [sweep] } } };
  const before = JSON.stringify(snapshot), levels = snapshotStructureLevels(snapshot);
  expect(levels).toEqual(expect.arrayContaining([
    expect.objectContaining({ price: 2, fromTime: 100, toTime: 840, styleKey: 'rangeHigh' }),
    expect.objectContaining({ price: 1.5, fromTime: 300, toTime: 500, styleKey: 'rangeLqSweep' }),
  ]));
  expect(JSON.stringify(snapshot)).toBe(before);
});

it('loads both real structure endpoints within a bounded chart window', () => {
  const snapshot = { knownAt: 1790338500, evidence: [{ role: 'structure', styleKey: 'rangeLiveDowntrend',
    fromTime: 1790272800, toTime: 1788937200 }, { role: 'structure', styleKey: 'rangeClosed', fromTime: 1, toTime: 2 }] };
  expect(snapshotChartCandleCount(snapshot, '5m', 1000)).toBe(4691);
  expect(snapshotChartCandleCount(snapshot, '1m', 1000)).toBe(23375);
  expect(snapshotChartCandleCount(snapshot, '1h', 1000)).toBe(1000);
  expect(snapshotChartCandleCount({ ...snapshot, knownAt: 1e10 }, '1m', 1000)).toBe(50000);
});
