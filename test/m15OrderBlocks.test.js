import { describe, expect, it } from 'vitest';
import { dropLowerTimeframeDuplicates, WATCHED_OB_TIMEFRAMES } from '../supabase/functions/_shared/obTimeframes.js';
import { detectOrderBlocks as detectFrontend } from '../src/orderBlockDetection.js';
import { detectOrderBlocks as detectMcp } from '../supabase/functions/trading-monitor-mcp/orderBlockDetection.js';
import { detectOrderBlocks as detectShared } from '../supabase/functions/_shared/orderBlocks.ts';
import { collectObsZones, obBoxTouchState } from '../src/priceChartObZones.js';
import { unprocessedTimeframes } from '../supabase/functions/poi-watcher/fxcmRefresh.js';
import { fetchForexBatch } from '../supabase/functions/poi-watcher/forexBatch.ts';
import { obMinimum } from '../src/instrumentConfig.js';
import { obMinimum as obMinimumShared } from '../supabase/functions/_shared/instrumentConfig.js';

// Bullische FVG zwischen c1.high (1,30000) und cur.low, Größe in Pips.
function bullFvg(gapPips) {
  const low = 1.3 + gapPips * 0.0001;
  return [
    { time: 0, open: 1.2999, high: 1.29995, low: 1.2998, close: 1.2999 },
    { time: 900, open: 1.2999, high: 1.3, low: 1.2998, close: 1.29995 },
    { time: 1800, open: 1.29995, high: low + 0.0004, low: 1.2999, close: low + 0.0003 },
    { time: 2700, open: low + 0.0003, high: low + 0.0008, low, close: low + 0.0006 },
  ];
}

describe('M15-OB-Erkennung: 1-Pip-Minimum in allen drei Kopien', () => {
  for (const [name, detect] of [['Frontend', detectFrontend], ['MCP', detectMcp], ['_shared', detectShared]]) {
    it(`${name}: 0,9 Pip fällt raus, 1,1 Pip bleibt`, () => {
      expect(detect(bullFvg(0.9), '15M')).toHaveLength(0);
      expect(detect(bullFvg(1.1), '15M')).toHaveLength(1);
    });
  }
  it('Gold-15M hat in beiden Runtimes dieselbe absolute Mindestgröße', () => {
    expect(obMinimum('XAUUSD', '15M')).toBe(1.5);
    expect(obMinimumShared('XAUUSD', '15M')).toBe(1.5);
  });
});

describe('WATCHED_OB_TIMEFRAMES', () => {
  it('höchste Zeitebene zuerst, inkl. 15M', () => {
    expect(WATCHED_OB_TIMEFRAMES).toEqual(['4H', '1H', '15M']);
  });
  it('bei gleicher Spanne gewinnt die höhere Zeitebene', () => {
    const zone = (timeframe, top) => ({ timeframe, top, bottom: top - 0.001 });
    const zones = [zone('15M', 1.3), zone('1H', 1.3), zone('4H', 1.3), zone('15M', 1.31), zone('15M', 1.32), zone('1H', 1.32)];
    expect(dropLowerTimeframeDuplicates(zones, 0.000005).map(z => `${z.timeframe}@${z.top}`))
      .toEqual(['4H@1.3', '15M@1.31', '1H@1.32']);
  });
});

describe('Chart: 15M-Toggle', () => {
  const dbObZones = [
    { instrument: 'GBPUSD', timeframe: '15M', dir: 1, top: 1.3, bottom: 1.299, startTime: 0, touched: false, invalidated: false },
    { instrument: 'GBPUSD', timeframe: '1H', dir: 1, top: 1.31, bottom: 1.309, startTime: 0, touched: false, invalidated: false },
  ];
  const ctx = { dbObZones, symbol: 'GBPUSD', replayUntil: null, price: null, m5Candles: [] };
  it('zeigt 15M nur bei aktivem Toggle', () => {
    expect(collectObsZones({ ...ctx, showObs1h: true }).map(z => z.timeframe)).toEqual(['1H']);
    expect(collectObsZones({ ...ctx, showObs1h: true, showObs15m: true }).map(z => z.timeframe)).toEqual(['1H', '15M']);
  });
  it('Journal-Box einer 15M-Zone übernimmt den Watcher-Zustand wie 1H/4H', () => {
    const item = { timeframe: '15M', rangeHigh: 1.3, rangeLow: 1.299, sourceTime: 0 };
    const state = obBoxTouchState(item, [{ time: 5000, low: 1.2995, high: 1.301 }], ctx);
    expect(state.touched).toBe(false);
  });
});

describe('poi-watcher: M15-Checkpoint und optionaler Feed', () => {
  it('überspringt eine unveränderte M15-Serie wie 1H', () => {
    const series = new Map([['M5', [{ time: 1 }]], ['1H', [{ time: 2 }]], ['15M', [{ time: 3 }]]]);
    expect([...unprocessedTimeframes(series, { '1H': 2, '15M': 3 }).keys()]).toEqual(['M5']);
    expect([...unprocessedTimeframes(series, { '1H': 2, '15M': 2 }).keys()]).toEqual(['M5', '15M']);
  });

  // Fake-PostgREST: liefert je bar die hinterlegten Zeilen (absteigend, wie readFxcmCandles fragt).
  function fakeDb(barsWithData) {
    return {
      from: () => {
        const q = { bar: null };
        const chain = {
          select: () => chain,
          eq: (col, value) => { if (col === 'bar') q.bar = value; return chain; },
          lt: () => chain,
          order: () => chain,
          limit: () => Promise.resolve({ data: q.bar in barsWithData ? barsWithData[q.bar].splice(0) : [], error: null }),
        };
        return chain;
      },
    };
  }
  const row = (sec) => ({ time: new Date(sec * 1000).toISOString(), open: 1, high: 1, low: 1, close: 1, volume: 0 });
  const now = Math.floor(Date.now() / 1000);

  it('fehlendes 15m (Gold-Collector) lässt 1H/M5 laufen, M15 fehlt nur in der Map', async () => {
    const batch = await fetchForexBatch(fakeDb({ '5m': [row(now - 60)], '1h': [row(now - 3600)], '4h': [row(now - 14400)] }), 'XAUUSD', now - 14400);
    expect([...batch.candlesByTf.keys()]).toEqual(['M5', '1H']);
  });
  it('vorhandenes 15m landet als "15M" im Batch', async () => {
    const batch = await fetchForexBatch(fakeDb({ '5m': [row(now - 60)], '1h': [row(now - 3600)], '4h': [row(now - 14400)], '15m': [row(now - 900)] }), 'GBPUSD', now - 14400);
    expect(batch.candlesByTf.get('15M')).toHaveLength(1);
  });
});
