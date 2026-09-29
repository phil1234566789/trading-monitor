import { afterEach, describe, expect, it, vi } from 'vitest';
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
async function setup(clock, rows = m1) {
  scope = effectScope();
  const props = reactive({ symbol: 'GBPUSD', replayUntil: at(clock), currentBar: '1m', showM1Structure: true,
    showTradeSetupChecklist: true, rangesFixedStartActive: true, rangesFixedStartTime: h1.cutoff });
  const fetchCached = vi.fn(async () => rows);
  const api = scope.run(() => {
    const checklist = usePriceChartChecklist(props, reactive(m5.sessions), () => {}, () => at('12:00'));
    const structure = usePriceChartM1Structure(props, checklist.state,
      { fetchCached, now: () => at('12:00') * 1000, prerequisitesAt: checklist.m1PrerequisitesAt });
    structure.create({});
    return { checklist, structure };
  });
  const fill = async () => {
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
    expect(s.checklist.state.value.evaluatedAt).toBe(Math.floor(at(clock) / 300) * 300 + 300);
  });
  it('does not borrow the future ABC confirmation from the M5 replay boundary', async () => {
    const s = await setup('09:25');
    expect(s.checklist.state.value.checks.reaction.status).toBe('passed');
    expect(s.structure.check.value.reason).toBe('abc');
    expect(s.fetchCached).not.toHaveBeenCalled();
  });
  it('rechecks prerequisites at the real close when the requested M1 candle is absent', async () => {
    const s = await setup('09:30', m1.filter(c => c.time < at('09:29')));
    expect(s.structure.check.value.reason).toBe('abc');
    expect(s.structure.check.value.fvg).toBeUndefined();
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
});
