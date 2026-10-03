import { afterEach, describe, expect, it, vi } from 'vitest';
import { assumeFixtureH1Direction } from './helpers/fixtureH1Direction.js';
assumeFixtureH1Direction('downtrend', true);
import { effectScope, nextTick, reactive } from 'vue';
vi.mock('../src/forexCandles.js', () => ({ fetchInitialCandles: vi.fn() }));
vi.mock('../src/ignoredCandles.js', () => ({ markIgnored: rows => rows }));
vi.mock('../src/structureOverlay.js', () => ({ renderLowerStructure: vi.fn() }));
import { usePriceChartChecklist } from '../src/composables/usePriceChartChecklist.js';
import { usePriceChartM1Structure } from '../src/composables/usePriceChartM1Structure.js';
import h1 from './fixtures/gbpusd-h1-dr114-lifecycle.json';
import m5 from './fixtures/gbpusd-m5-dr114-session-targets.json';
import m5Candles from './fixtures/gbpusd-m5-dr114-close-reaction.json';
import m1 from './fixtures/gbpusd-m1-dr114-p5.json';

const at = clock => Date.parse(`2026-09-09T${clock}:00+02:00`) / 1000;
let scope;
afterEach(() => { scope?.stop(); vi.useRealTimers(); });
async function setup(clock, rows = m1, currentBar = '1m') {
  scope = effectScope();
  const props = reactive({ symbol: 'GBPUSD', replayUntil: at(clock), currentBar, showM1Structure: true,
    showTradeSetupChecklist: true, rangesFixedStartActive: true, rangesFixedStartTime: h1.cutoff });
  const fetchCached = vi.fn(async () => rows);
  const api = scope.run(() => {
    const checklist = usePriceChartChecklist(props, reactive(m5.sessions), () => {}, () => at('12:00'));
    const structure = usePriceChartM1Structure(props, checklist.state,
      { fetchCached, now: () => at('12:00') * 1000, prerequisitesAt: checklist.m1PrerequisitesAt, evaluationHorizon: checklist.evaluationTime });
    structure.create({ attachPrimitive: vi.fn(), detachPrimitive: vi.fn() });
    return { checklist, structure };
  });
  const fill = async () => {
    api.checklist.setChartCandles(props.currentBar === '1m' ? m1 : m5Candles, `${props.symbol}:${props.currentBar}`);
    for (const [tf, rows] of [['h1', h1.candles], ['m5', m5Candles]]) {
      api.checklist.finish(api.checklist.begin(tf), { ok: true, applied: true }, rows);
    }
    await nextTick(); await nextTick();
  };
  await fill();
  return { ...api, props, fetchCached, fill };
}

describe('DR114 independent M1 checklist clock', () => {
  it.each([
    ['09:30', 1, false, false, false],
    ['09:35', 1, true, false, false],
    ['09:39', 2, true, false, false],
    ['09:46', 2, true, true, false],
    ['09:49', 2, true, true, true],
  ])('evaluates the closed M1 prefix at replay %s', async (clock, depth, signals, retest, fvg) => {
    const s = await setup(clock);
    const check = s.structure.check.value;
    expect(check.evaluatedAt).toBe(at(clock) + 60);
    expect(check.trends).toHaveLength(depth);
    expect(!!check.choch).toBe(signals);
    expect(!!check.bos).toBe(signals);
    expect(!!check.retest).toBe(retest);
    expect(!!check.fvg).toBe(fvg);
    expect(!!check.entry).toBe(fvg);
    expect(s.checklist.state.value.evaluatedAt).toBe(at(clock) + 60);
  });
  it('does not show future ABC on an M1 chart', async () => {
    const s = await setup('09:25');
    expect(s.checklist.state.value.evaluatedAt).toBe(at('09:26'));
    expect(s.checklist.state.value.checks.reaction.status).not.toBe('passed');
    expect(s.structure.check.value.reason).toBe('abc');
    expect(s.fetchCached).not.toHaveBeenCalled();
  });
  it('uses the visible M5 close and resets the horizon across timeframe changes', async () => {
    const s = await setup('09:25', m1, '5m');
    expect(s.checklist.state.value.evaluatedAt).toBe(at('09:30'));
    expect(s.checklist.state.value.checks.reaction.status).toBe('passed');
    expect(s.structure.check.value.evaluatedAt).toBe(at('09:30'));
    expect(s.structure.check.value.trends).toHaveLength(1);
    expect(s.fetchCached.mock.calls.at(-1)[4]).toBe(at('09:30') * 1000);
    s.props.currentBar = '1m';
    expect(s.checklist.evaluationTime()).toBeNull();
    await nextTick(); await s.fill();
    expect(s.checklist.state.value.evaluatedAt).toBe(at('09:26'));
    expect(s.structure.check.value.reason).toBe('abc');
    s.props.currentBar = '5m'; await nextTick(); await s.fill();
    expect(s.structure.check.value.evaluatedAt).toBe(at('09:30'));
    s.props.replayUntil = at('09:45'); await nextTick(); await s.fill();
    expect(s.structure.check.value.fvg).toBeTruthy();
    s.props.replayUntil = at('09:25'); await nextTick(); await s.fill();
    expect(s.structure.check.value.evaluatedAt).toBe(at('09:30'));
    expect(s.structure.check.value.fvg).toBeNull();
  // Mehrere vollständige H1/M5/M1-Neuberechnungen brauchen im parallelen Gesamtlauf mehr als 5 s.
  }, 15000);
  it('rechecks prerequisites at the real close when the requested M1 candle is absent', async () => {
    const s = await setup('09:30', m1.filter(c => c.time < at('09:29')));
    expect(s.structure.check.value.reason).toBe('abc');
    expect(s.structure.check.value.fvg).toBeUndefined();
  });
  it('uses an actual chart candle rather than adding the timeframe duration to the replay input', async () => {
    const s = await setup('09:25', m1, '5m');
    s.checklist.setChartCandles(m5Candles.filter(c => c.time < at('09:25')), 'GBPUSD:5m');
    await nextTick(); await nextTick();
    expect(s.checklist.state.value.evaluatedAt).toBe(at('09:25'));
    expect(s.structure.check.value.reason).toBe('abc');
  });
  it('reports a missing latest M1 candle as unknown, not as a failed FVG condition', async () => {
    const s = await setup('09:49', m1.filter(c => c.time < at('09:48')));
    expect(s.structure.check.value.reason).toBe('missing');
    expect(s.structure.check.value.evaluatedAt).toBe(at('09:48'));
    expect(s.structure.check.value.detailStatuses).toEqual([]);
  });
  it('rewinds without retaining later retest or FVG signals and caches M5 prerequisites within a minute interval', async () => {
    const s = await setup('09:49');
    expect(s.structure.check.value.fvg).toBeTruthy();
    expect(s.checklist.m1PrerequisitesAt(at('09:46'))).toBe(s.checklist.m1PrerequisitesAt(at('09:49')));
    s.props.replayUntil = at('09:46');
    await nextTick(); await s.fill();
    expect(s.structure.check.value.retest).toBeTruthy();
    expect(s.structure.check.value.fvg).toBeNull();
    s.props.showM1Structure = false; await nextTick();
    expect(s.structure.check.value.reason).toBe('disabled');
  });
  it('keeps the entry snapshot through later candles and restores it deterministically after rewind', async () => {
    const s = await setup('09:49');
    const entry = s.structure.check.value.entry;
    expect(entry.candleTime).toBe(at('09:49'));
    expect(entry.stops.narrow.price).toBe(1.35648);
    s.props.replayUntil = at('10:10'); await nextTick(); await s.fill();
    expect(s.structure.check.value.entry).toEqual(entry);
    s.props.replayUntil = at('09:48'); await nextTick(); await s.fill();
    expect(s.structure.check.value.entry).toBeNull();
    s.props.replayUntil = at('09:49'); await nextTick(); await s.fill();
    expect(s.structure.check.value.entry).toEqual(entry);
    s.props.currentBar = '5m'; await nextTick(); await s.fill();
    expect(s.structure.check.value.entry).toEqual(entry);
    s.props.showM1Structure = false; await nextTick();
    expect(s.structure.check.value.entry).toBeUndefined();
  }, 15000);
});
