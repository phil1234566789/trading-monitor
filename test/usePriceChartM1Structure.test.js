import { afterEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, reactive, shallowRef } from 'vue';
vi.mock('../src/forexCandles.js', () => ({ fetchInitialCandles: vi.fn() }));
vi.mock('../src/ignoredCandles.js', () => ({ markIgnored: rows => rows }));
vi.mock('../src/structureOverlay.js', () => ({ renderLowerStructure: vi.fn() }));
import { renderLowerStructure } from '../src/structureOverlay.js';
import { usePriceChartM1Structure } from '../src/composables/usePriceChartM1Structure.js';

const ready = (id = 'one') => ({ status: 'ready', instrument: 'GBPUSD', evaluatedAt: 1800,
  setup: { primary: { id, validity: { state: 'active' } } },
  checks: { h1Trend: { status: 'passed' }, liquiditySweep: { status: 'passed' }, reaction: { status: 'passed' },
    m5Trend: { m1Anchor: { pivotTime: 600, price: 10, recognizedAt: 900 } } } });
const rows = Array.from({ length: 50 }, (_, i) => ({ time: i * 60, open: 10, close: 10,
  high: 11 + Math.sin(i), low: 9 + Math.sin(i) }));
let scope;
afterEach(() => { scope?.stop(); vi.useRealTimers(); vi.clearAllMocks(); });
function setup(fetchCached = vi.fn(async () => rows), replayUntil = 1500, now = () => 1800_000) {
  scope = effectScope();
  const state = shallowRef(null);
  const props = reactive({ symbol: 'GBPUSD', replayUntil, currentBar: '5m', showM1Structure: true,
    showLiquidityDebug: false });
  const api = scope.run(() => usePriceChartM1Structure(props, state, { fetchCached, now }));
  api.create({}); api.refresh(rows.filter((_, i) => i % 5 === 0));
  return { state, props, api, fetchCached };
}
describe('independent M1 structure lifecycle', () => {
  it('does not load or evaluate live M1 while saved detail is selected', async () => {
    scope=effectScope();
    const fetchCached=vi.fn(),prerequisitesAt=vi.fn(()=>ready());
    const api=scope.run(()=>usePriceChartM1Structure(reactive({symbol:'GBPUSD',currentBar:'5m',replayUntil:1500,showM1Structure:true}),
      shallowRef(ready()),{fetchCached,prerequisitesAt,evaluationHorizon:()=>1800,detailSelected:()=>true}));
    api.create({});api.refresh(rows);await nextTick();
    expect(fetchCached).not.toHaveBeenCalled();expect(prerequisitesAt).not.toHaveBeenCalled();
  });
  it('marks an independent slow M1 poll busy until its response is evaluated', async () => {
    vi.useFakeTimers();
    let resolve;
    const s = setup(vi.fn().mockResolvedValueOnce(rows).mockImplementation(() => new Promise(done => { resolve = done; })), null);
    s.state.value = ready(); await nextTick();
    expect(s.api.check.value.updating).not.toBe(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(s.api.check.value.updating).toBe(true);
    expect(s.api.check.value.reason).toBe('loading');
    resolve(rows); await nextTick();
    expect(s.api.check.value.updating).not.toBe(true);
  });
  it('keeps a failed poll unknown through later chart redraws', async () => {
    vi.useFakeTimers();
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const s = setup(vi.fn().mockResolvedValueOnce(rows).mockRejectedValue(new Error('network')), null);
      s.state.value = ready(); await nextTick();
      await vi.advanceTimersByTimeAsync(60_000);
      s.api.refresh(rows);
      expect(s.api.check.value.reason).toBe('error');
      expect(s.api.status.value.state).toBe('error');
    } finally { log.mockRestore(); }
  });
  it('publishes new closed M1 data between M5 closes without another checklist update', async () => {
    vi.useFakeTimers();
    let time = 1810_000;
    const s = setup(undefined, null, () => time);
    s.state.value = ready(); await nextTick();
    expect(s.api.check.value.evaluatedAt).toBe(1800);
    time = 1870_000;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(s.api.check.value.evaluatedAt).toBe(1860);
    expect(s.state.value.evaluatedAt).toBe(1800);
  });
  it('does not fetch before A/B/C and uses M1 independently of chart timeframe', async () => {
    const s = setup();
    expect(s.fetchCached).not.toHaveBeenCalled();
    s.state.value = ready(); await nextTick();
    expect(s.fetchCached.mock.calls[0][2]).toBe('1m');
    expect(s.api.status.value.state).toBe('ready');
    s.props.currentBar = '1m'; s.api.refresh(rows); await nextTick();
    expect(s.fetchCached.mock.calls.every(call => call[2] === '1m')).toBe(true);
    s.props.showLiquidityDebug = true; await nextTick();
    expect(renderLowerStructure.mock.calls.at(-1).at(-1).debug).toBe(true);
    expect(renderLowerStructure.mock.calls.at(-1)[1].pivotsInner).toEqual([]);
    s.props.showM1Structure = false; await nextTick();
    expect(renderLowerStructure.mock.calls.at(-1)[1]).toBeNull();
  });
  it('ignores delayed responses after setup end, symbol change and disposal', async () => {
    const pending = [];
    const s = setup(vi.fn(() => new Promise(resolve => pending.push(resolve))));
    s.state.value = ready();
    s.state.value = { ...ready(), setup: { primary: null } };
    pending[0](rows); await nextTick();
    expect(s.api.status.value.state).toBe('waiting');
    s.state.value = ready('two');
    s.props.symbol = 'EURUSD'; await nextTick();
    pending[1](rows); await nextTick();
    expect(s.api.status.value.state).toBe('waiting');
    scope.stop();
  });
  it.each(['target1', 'invalidation'])('stops M1 polling at %s, resumes on replay rewind', async reason => {
    vi.useFakeTimers();
    const s = setup(undefined, null);
    s.state.value = ready(); await nextTick();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(s.fetchCached).toHaveBeenCalledTimes(2);
    s.state.value = { ...ready(), setup: { primary: { id: 'one', validity: { state: 'ended', reason } } } };
    await vi.advanceTimersByTimeAsync(120_000);
    expect(s.fetchCached).toHaveBeenCalledTimes(2);
    s.props.replayUntil = 1500; s.state.value = ready(); await nextTick();
    expect(s.fetchCached.mock.calls.length).toBeGreaterThan(2);
    const count = s.fetchCached.mock.calls.length;
    await vi.advanceTimersByTimeAsync(120_000);
    expect(s.fetchCached).toHaveBeenCalledTimes(count);
  });
  it('never applies a later replay response after rewind', async () => {
    const pending = [];
    const s = setup(vi.fn(() => new Promise(resolve => pending.push(resolve))));
    s.state.value = ready();
    s.props.replayUntil = 600; s.state.value = null; await nextTick();
    pending[0](rows); await nextTick();
    expect(s.api.status.value.state).toBe('waiting');
    expect(renderLowerStructure.mock.calls.at(-1)[1]).toBeNull();
  });
});
