import { describe, expect, it } from 'vitest';
import archive from './fixtures/gbpusd-m5-dr114-close-reaction.json';
import { createChartStructureCalculator } from '../src/chartStructureCalculation.js';
import { computeRangesPivots, buildMarketStructureState } from '../src/marketStructureAnalysis';
import { buildStructureWithPhases } from '../src/trendPhases.js';
import { fmtDateTime } from '../src/format.js';

const at = clock => Date.parse(`2026-09-09T${clock}:00+02:00`) / 1000;
const anchor = 1788350400;
const input = clock => ({ kind: 'm5', symbol: 'GBPUSD', anchor, periodOuter: 5, periodInner: 2,
  candles: archive.filter(c => c.time <= at(clock)) });
function reference(value) {
  const outer = computeRangesPivots(value.candles, value.periodOuter, value.anchor, fmtDateTime);
  const inner = computeRangesPivots(value.candles, value.periodInner, value.anchor, fmtDateTime);
  return { ...buildStructureWithPhases(outer, inner, value.periodOuter, value.periodInner,
    value.candles, 300, { closeEvaluation: true }), pivotsOuter: outer, pivotsInner: inner };
}
describe('normal structure calculation parity', () => {
  it('preserves complete M5 state, close levels, phases and pivot identity after cloning', () => {
    const calculate = createChartStructureCalculator();
    for (const clock of ['09:45', '10:00', '10:20', '09:45', '10:00']) {
      const value = input(clock);
      expect(calculate(structuredClone(value))).toEqual(reference(value));
    }
  });
  it('does not reuse historical close facts after an interior correction or setting change', () => {
    const calculate = createChartStructureCalculator();
    calculate(input('10:00'));
    const corrected = structuredClone(input('10:20'));
    corrected.candles[30].close += 0.01;
    corrected.candles[30].high = Math.max(corrected.candles[30].high, corrected.candles[30].close);
    expect(calculate(corrected)).toEqual(reference(corrected));
    const changed = { ...corrected, periodOuter: 4, anchor: anchor + 3600 };
    expect(calculate(changed)).toEqual(reference(changed));
  });
  it('uses unchanged H1 state semantics', () => {
    const value = input('10:00');
    const pivotsOuter = computeRangesPivots(value.candles, 5, anchor);
    const pivotsInner = computeRangesPivots(value.candles, 2, anchor);
    expect(createChartStructureCalculator()({ ...value, kind: 'h1', pivotsOuter, pivotsInner }))
      .toEqual(buildMarketStructureState(pivotsOuter, pivotsInner, 5, 2, value.candles));
  });
});
