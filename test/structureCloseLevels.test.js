import { describe, expect, it, vi } from 'vitest';
import archive from './fixtures/gbpusd-m5-dr114-close-reaction.json';
import { computeRangesPivots } from '../src/marketStructureAnalysis';
import { buildStructureWithPhases } from '../src/trendPhases.js';
import { renderLowerStructure } from '../src/structureOverlay.js';
import { usePriceChartMarketStructure } from '../src/composables/usePriceChartMarketStructure.js';

const at = clock => Date.parse(`2026-09-09T${clock}:00+02:00`) / 1000;
function draw(clock, { mirrored = false, closeEvaluation = true } = {}) {
  const candles = archive.filter(c => c.time <= at(clock));
  const rows = mirrored ? candles.map(c => ({ ...c, open: 3-c.open, close: 3-c.close,
    high: 3-c.low, low: 3-c.high })) : candles;
  const result = buildStructureWithPhases(computeRangesPivots(rows, 5, 1788350400),
    computeRangesPivots(rows, 2, 1788350400), 5, 2, rows, 300, { closeEvaluation });
  const series = { attachPrimitive: vi.fn(), detachPrimitive: vi.fn() };
  const primitives = [];
  const options = { symbol: 'GBPUSD', replayUntil: at(clock), show: true, debug: false, barSeconds: 300 };
  renderLowerStructure(series, result, primitives, [], rows, options);
  return { primitives, series, result, rows, options };
}
const lines = (primitives, type) => primitives.filter(p => p._options?.label?.startsWith(type));

describe('M5 close levels through the shared chart renderer', () => {
  it('filters live unfinished candles and recomputes the same cache on replay rewind', () => {
    const api = usePriceChartMarketStructure();
    const attached = new Set();
    api.create({}, { attachPrimitive: p => attached.add(p), detachPrimitive: p => attached.delete(p) });
    api.computeRangesPivotsAndMetadata(archive.slice(0, 2), {
      symbol: 'GBPUSD', rangesPeriod: 5, ranges2Period: 2,
      rangesFixedStartActive: true, rangesFixedStartTime: 1788350400,
    });
    const clock = vi.spyOn(Date, 'now');
    const refresh = (now, replayUntil, choch, bos) => {
      clock.mockReturnValue(at(now) * 1000);
      api.refreshM5Structure({ candles: archive.filter(c => c.time <= (replayUntil ?? at(now))),
        m5CandlesClipped: archive, symbol: 'GBPUSD', replayUntil, showM5Structure: true,
        showM5TrendPhases: false, showLiquidityDebug: false, m5Period: 5, m5Period2: 2 });
      for (const [type, price, confirmed] of [['CHoCH', 1.35576, choch], ['BOS', 1.35554, bos]]) {
        const matching = lines([...attached], type).filter(p => Math.abs(p.level.price-price) < 1e-8);
        expect(matching).toHaveLength(1);
        expect(matching[0]._options.dashed).toBe(confirmed);
      }
    };
    try {
      refresh('09:54', null, false, false);
      refresh('09:55', null, true, false);
      refresh('10:05', null, true, true);
      refresh('10:35', at('09:45'), false, false);
      refresh('10:35', at('10:00'), true, true);
    } finally { clock.mockRestore(); api.dispose(); }
  });
  it.each([
    ['09:45', null, null], ['09:50', '09:50', null], ['09:55', '09:50', null],
    ['10:00', '09:50', '10:00'], ['10:20', '09:50', '10:00'],
  ])('draws each current level once at %s, with its actual M5 break endpoint', (clock, choch, bos) => {
    const { primitives } = draw(clock);
    for (const [type, price, broken] of [['CHoCH', 1.35576, choch], ['BOS', 1.35554, bos]]) {
      const matching = lines(primitives, type).filter(p => Math.abs(p.level.price - price) < 1e-8);
      expect(matching).toHaveLength(1);
      expect(matching[0]._options).toMatchObject({ label: broken ? type : `${type} offen`, dashed: !!broken });
      expect(matching[0].level.endTime).toBe(at(broken ?? clock));
    }
  });
  it('mirrors line labels and price levels for long', () => {
    const { primitives } = draw('10:00', { mirrored: true });
    const choch = lines(primitives, 'CHoCH').find(p => Math.abs(p.level.price - (3-1.35576)) < 1e-8);
    const bos = lines(primitives, 'BOS').find(p => Math.abs(p.level.price - (3-1.35554)) < 1e-8);
    expect(choch._options.labelSide).toBe('center-above');
    expect(bos._options.labelSide).toBe('center-below');
  });
  it('removes every associated primitive when the structure toggle is off', () => {
    const { series, result, primitives, rows, options } = draw('10:00');
    const count = primitives.length;
    renderLowerStructure(series, result, primitives, [], rows, { ...options, show: false });
    expect(primitives).toEqual([]);
    expect(series.detachPrimitive).toHaveBeenCalledTimes(count);
  });
  it('keeps the existing drawing when close evaluation is not enabled (M1)', () => {
    const { primitives } = draw('09:45', { closeEvaluation: false });
    expect(lines(primitives, 'CHoCH')).toHaveLength(0);
    expect(lines(primitives, 'BOS')).toHaveLength(2); // Bestehende historische Brüche bleiben sichtbar.
    expect(lines(primitives, 'BOS').some(p => p._options.label.endsWith('offen'))).toBe(false);
    expect(lines(primitives, 'protected low')).toHaveLength(1);
  });
});
