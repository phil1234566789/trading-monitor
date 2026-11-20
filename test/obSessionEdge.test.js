// Pin 603 (Philip, 20.11.2026): EURUSD-15M-Long vom 19.11., c1 (04:45 Berlin) ist das Asia-Low,
// die OB entsteht um 05:15, Asia endet erst 07:00. Bis dahin c2-Kante, danach das Asia-Low.
import { describe, expect, it } from 'vitest';
import rows from './fixtures/pin603-eurusd-m15.json';
import { htfObCandles } from '../supabase/functions/_shared/sessionOccurrences.js';
import { berlinOffsetMinutes } from '../supabase/functions/_shared/berlinTime.ts';
import { detectOrderBlocks as detectFrontend } from '../src/orderBlockDetection.js';
import { detectOrderBlocks as detectMcp } from '../supabase/functions/trading-monitor-mcp/orderBlockDetection.js';
import { detectOrderBlocks as detectShared } from '../supabase/functions/_shared/orderBlocks.ts';
import { createIncrementalOrderBlockDetector } from '../src/incrementalOrderBlocks.js';

const ASIA = { fromMinutes: 0, toMinutes: 420, days: null, highLowRelevant: true };
const candles = htfObCandles(rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })),
  [ASIA], (sec) => berlinOffsetMinutes(sec * 1000));
const C1 = Date.parse('2026-11-19T03:45:00Z') / 1000;
const C2 = Date.parse('2026-11-19T04:00:00Z') / 1000;
const ASIA_END = Date.parse('2026-11-19T06:00:00Z') / 1000;
const pinZone = (zones) => zones.find((z) => z.dir === 1 && z.startTime === C2);

describe('Session-Low-Kante wird nach Session-Ende nachgetragen (Pin 603)', () => {
  for (const [name, detect] of [['Frontend', detectFrontend], ['MCP', detectMcp], ['_shared', detectShared]]) {
    it(`${name}: vor Asia-Ende c2-Kante, danach Asia-Low`, () => {
      const before = pinZone(detect(candles.filter((c) => c.time < ASIA_END), '15M'));
      expect(before).toMatchObject({ top: 1.09579, bottom: 1.09566 });
      expect(before.drawStartTime).toBeUndefined();
      const after = pinZone(detect(candles, '15M'));
      expect(after).toMatchObject({ top: 1.09579, bottom: 1.09551, drawStartTime: C1, invalidated: false });
      expect(after).not.toHaveProperty('pendingEdge');
    });
  }
  it('inkrementelle Erkennung kommt Kerze für Kerze zum selben Ergebnis', () => {
    const detect = createIncrementalOrderBlockDetector('15M');
    let zones;
    for (let n = 4; n <= candles.length; n++) zones = detect(candles.slice(0, n));
    expect(pinZone(zones)).toEqual(pinZone(detectFrontend(candles, '15M')));
  });
  it('ohne Session-Markierung bleibt es bei der c2-Kante', () => {
    const plain = rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
    expect(pinZone(detectFrontend(plain, '15M')).bottom).toBe(1.09566);
  });
  it('M5 bleibt bei der 3-Kerzen-Box (keine Session-Kante)', () => {
    const zones = detectFrontend(candles, '5m');
    expect(zones.every((z) => !('pendingEdge' in z))).toBe(true);
  });
});

describe('Journal-Verweis auf eine nachträglich verbreiterte Zone', () => {
  it('findet die Live-Zone über Startzeit und FVG-Kante, auch mit alter c2-Kante im Snapshot', async () => {
    const { liveObZoneState } = await import('../src/priceChartObZones.js');
    const dbObZones = [{ instrument: 'EURUSD', timeframe: '15M', dir: 1, top: 1.09579, bottom: 1.09551, startTime: C2, endTime: C2 + 900, touched: true, invalidated: false }];
    const item = { timeframe: '15M', rangeHigh: 1.09579, rangeLow: 1.09566, sourceTime: C2 };
    expect(liveObZoneState(item, { dbObZones, symbol: 'EURUSD', replayUntil: null, m5Candles: [] })).toMatchObject({ touched: true });
  });
});
