import { describe, expect, it } from 'vitest';
import candles from './fixtures/gbpusd-h1-2026-07-23-live-metadata-snapshot.json';
import { checklistEvaluationTime, closedChecklistCandles, evaluateTradeSetupChecklist } from '../src/tradeSetupChecklist.js';
import { createChecklistDataAdapter } from '../src/tradeSetupChecklistData.js';

const settings = { rangesPeriod: 5, ranges2Period: 2, rangesFixedStartActive: true, rangesFixedStartTime: 1783918800 };
const evaluatedAt = candles.at(-1).time + 3600;
const input = { instrument: 'GBPUSD', evaluatedAt, settings, h1Candles: candles, m5Candles: [{ time: evaluatedAt - 300, open: 1, high: 2, low: 0, close: 1 }] };

describe('Checklist: geschlossener Wissensstand', () => {
  it('verwendet echte Schlussgrenzen, auch bei Lücken', () => {
    const rows = [{ time: 0 }, { time: 300 }, { time: 1800 }];
    expect(closedChecklistCandles(rows, '5m', 599)).toEqual([{ time: 0 }]);
    expect(closedChecklistCandles(rows, '5m', 600)).toEqual(rows.slice(0, 2));
    expect(closedChecklistCandles(rows, '1h', 3599)).toEqual([]);
    expect(closedChecklistCandles(rows, '1h', 3600)).toEqual([{ time: 0 }]);
  });
  it('liefert nach Vor/Zurück dasselbe Ergebnis wie ein reines Kerzenpräfix', () => {
    const at = evaluatedAt - 4 * 3600;
    const historical = { ...input, evaluatedAt: at, m5Candles: [{ ...input.m5Candles[0], time: at - 300 }] };
    const full = evaluateTradeSetupChecklist(historical);
    expect(full.status).toBe('ready');
    expect(full.structure).toBeTruthy();
    evaluateTradeSetupChecklist(input);
    expect(evaluateTradeSetupChecklist({ ...historical, h1Candles: candles.filter(c => c.time + 3600 <= at) })).toEqual(full);
  });
  it('berechnet A/B aus echten Kerzen und kennzeichnet unfertige Zuordnungen ohne Gesamt-Go', () => {
    const result = evaluateTradeSetupChecklist(input);
    expect(result.checks.h1Trend.status).toBe('passed');
    expect(['long', 'short']).toContain(result.direction);
    expect(result.status).toBe('ready');
    for (const [id, check] of Object.entries(result.checks)) {
      if (!['h1Trend', 'liquiditySweep'].includes(id)) expect(['pending', 'unknown', 'deferred']).toContain(check.status);
    }
    expect(result.checks.liquiditySweep.status).toBe('passed');
    expect(result.setup.primary).toBeTruthy();
    expect(result.setup.primary.validity.state).toBe('unknown');
    expect(result.checks.targets.status).toBe('unknown');
    expect(result.checks.targets.details.join(' ')).toContain('Vorläufige Zielkandidaten');
    expect(result).not.toHaveProperty('go');
  });
  it('beschriftet abweichende Strukturperioden nicht als P2/P5-Ziele', () => {
    const result = evaluateTradeSetupChecklist({ ...input, settings: { ...settings, ranges2Period: 3 } });
    expect(result.checks.targets.status).toBe('unknown');
    expect(result.setup.targetPreview).toBeNull();
  });
  it('erfindet weder Trend noch Replay-Zeit', () => {
    expect(evaluateTradeSetupChecklist({ ...input, h1Candles: [] }).checks.h1Trend.status).toBe('unknown');
    expect(evaluateTradeSetupChecklist({ ...input, evaluatedAt: null }).status).toBe('missing');
    expect(evaluateTradeSetupChecklist({ ...input, h1Candles: [candles.at(-1)] }).checks.h1Trend.status).toBe('unknown');
    expect(checklistEvaluationTime(600, 900)).toBeNull();
    expect(checklistEvaluationTime(600, 900, 'strict')).toBe(600);
    expect(checklistEvaluationTime(600, 900, 'm5-close')).toBe(900);
    expect(checklistEvaluationTime(null, 900)).toBe(900);
  });
  it('kennzeichnet einen verspäteten Feed und lädt ihn nach', () => {
    const stale = evaluateTradeSetupChecklist({ ...input, m5Candles: [{ ...input.m5Candles[0], time: evaluatedAt - 600 }] });
    expect(stale.status).toBe('stale');
    expect(evaluateTradeSetupChecklist(input).status).toBe('ready');
  });
  it('prüft F auch bei fehlenden Kerzen und erfindet keine Kalenderabdeckung', () => {
    const windows = { weekday: [[0, 1440]], saturday: [[0, 1440]], sunday: [[0, 1440]] };
    const args = { ...input, h1Candles: [], tradingWindows: windows, news: [] };
    expect(evaluateTradeSetupChecklist(args).checks.time.status).toBe('unknown');
    expect(evaluateTradeSetupChecklist({ ...args, newsCoverage: 'confirmed' }).checks.time.status).toBe('passed');
    expect(evaluateTradeSetupChecklist({ ...args, news: [{ currency: 'USD', eventTime: evaluatedAt + 1800, title: 'Test' }] }).checks.time.status).toBe('blocked');
  });
});

describe('Checklist-Datenadapter', () => {
  it('verwirft Antworten nach Instrument-/Zeitwechsel und ältere Antworten desselben Fensters', () => {
    const adapter = createChecklistDataAdapter();
    adapter.reset('GBPUSD:1');
    const old = adapter.begin('h1');
    adapter.reset('EURUSD:2');
    expect(adapter.finish(old, { ok: true, applied: true }, candles)).toBe(false);
    const a = adapter.begin('h1');
    const b = adapter.begin('h1');
    expect(adapter.finish(a, { ok: true, applied: true }, candles)).toBe(false);
    expect(adapter.finish(b, { ok: true, applied: true }, candles)).toBe(true);
    expect(adapter.snapshot().h1.candles).toEqual(candles);
    adapter.reset('GBPUSD:1');
    expect(adapter.snapshot().h1.candles).toEqual([]);
  });
  it('trennt Ladefehler von fehlenden Daten', () => {
    const adapter = createChecklistDataAdapter();
    adapter.reset('x');
    expect(adapter.snapshot().status).toBe('loading');
    adapter.finish(adapter.begin('h1'), { ok: false, applied: false });
    expect(adapter.snapshot().status).toBe('error');
  });
});
