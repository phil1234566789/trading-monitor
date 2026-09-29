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
function setup(fetchCached = vi.fn(async () => rows), replayUntil = 1500) {
  scope = effectScope();
  const state = shallowRef(null);
  const props = reactive({ symbol: 'GBPUSD', replayUntil, currentBar: '5m', showM1Structure: true,
    showLiquidityDebug: false });
  const api = scope.run(() => usePriceChartM1Structure(props, state, { fetchCached, now: () => 1800_000 }));
  api.create({}); api.refresh(rows.filter((_, i) => i % 5 === 0));
  return { state, props, api, fetchCached };
}
describe('independent M1 structure lifecycle', () => {
  it('does not fetch before A/B/C and uses M1 independently of chart timeframe', async () => {
    const s = setup();
    expect(s.fetchCached).not.toHaveBeenCalled();
    s.state.value = ready(); await nextTick();
    expect(s.fetchCached.mock.calls[0][2]).toBe('1m');
    expect(s.api.status.value.state).toBe('ready');
    s.props.currentBar = '1h'; await nextTick();
    expect(s.fetchCached).toHaveBeenCalledTimes(1);
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
