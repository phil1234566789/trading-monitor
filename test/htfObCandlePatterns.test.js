import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { detectOrderBlocks } from '../src/orderBlockDetection.js';
import { detectOrderBlocks as mcp } from '../supabase/functions/trading-monitor-mcp/orderBlockDetection.js';
import { detectOrderBlocks as backend } from '../supabase/functions/_shared/orderBlocks.ts';
import { markIgnoredCandles, htfObCandles } from '../src/sessionOccurrences.js';
import * as sharedSessions from '../supabase/functions/_shared/sessionOccurrences.js';
import { berlinOffsetMinutes } from '../src/berlinTime.js';

const detectors = { frontend: detectOrderBlocks, mcp, backend };
const tz = (sec) => berlinOffsetMinutes(sec * 1000);
// XAU-Sessions wie in der sessions-Tabelle: NY (High/Low relevant) und Spread Hour (ignorieren).
const xauSessions = [
  { fromMinutes: 840, toMinutes: 1320, days: [1, 2, 3, 4, 5], highLowRelevant: true, ignoreLiquidity: false },
  { fromMinutes: 1380, toMinutes: 0, days: [1, 2, 3, 4, 5], highLowRelevant: true, ignoreLiquidity: true },
];
const fixture = JSON.parse(readFileSync(new URL('./fixtures/xau-h1-20261103-morning-star.json', import.meta.url)));
const native = fixture.candles.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
const c = (time, open, high, low, close, extra = {}) => ({ time, open, high, low, close, ...extra });

describe('XAU H1 03.11.2026: Morning Star mit NY-Low über die Tagespause', () => {
  for (const sessions of [{ markIgnoredCandles, htfObCandles }, sharedSessions]) {
    it('zeigt den bullischen OB ab der Stern-Kerze 21:00 mit deren Low als Unterkante', () => {
      const marked = sessions.htfObCandles(sessions.markIgnoredCandles(native, xauSessions, tz), xauSessions, tz);
      for (const detect of Object.values(detectors)) {
        const zone = detect(marked, '1H', false, 2.53).find((z) => z.dir === 1 && z.startTime === 1793739600);
        expect(zone).toMatchObject({ top: 3922.72, bottom: 3917.39, drawStartTime: 1793736000, invalidated: false, touched: true, touchedTime: 1793750400 });
        expect(zone.fvg).toBeCloseTo(3.9, 2);
      }
    });
  }

  it('entfernt im HTF-Pfad nur die flache ignorierte Pausenkerze, markIgnoredCandles selbst entfernt nichts', () => {
    const marked = markIgnoredCandles(native, xauSessions, tz);
    expect(marked.find((x) => x.time === 1793743200)?.ignored).toBe(true);
    expect(htfObCandles(marked, xauSessions, tz).some((x) => x.time === 1793743200)).toBe(false);
    const spread = markIgnoredCandles([c(1793743200, 1, 2, 0.5, 1.5)], xauSessions, tz);
    expect(htfObCandles(spread, [], tz)).toEqual([c(1793743200, 1, 2, 0.5, 1.5, { ignored: true })]);
  });
});

describe('HTF-OB-Kante über die Kerze vor der Impulskerze', () => {
  // Fenster: a (i-3), s (c1), b (c2), cur. Bullish FVG: cur.low > s.high.
  const morningStar = [c(0, 10, 12, 9, 11), c(3600, 20, 20.5, 14, 14.2), c(7200, 14.2, 14.5, 12, 14.4), c(10800, 14.4, 19, 13, 18.5), c(14400, 18.5, 20, 16, 19.5)];
  const bullZone = (rows) => (detect) => detect(rows, '1H', false, 1).find((z) => z.dir === 1);

  for (const [name, detect] of Object.entries(detectors)) {
    it(`${name}: Morning Star erweitert die Unterkante auf das Stern-Low`, () => {
      expect(bullZone(morningStar)(detect)).toMatchObject({ top: 14.5, bottom: 12, startTime: 10800, drawStartTime: 7200 });
    });

    it(`${name}: ohne Star und ohne Session-Extrem bleibt die enge Box`, () => {
      const noStar = morningStar.map((x, i) => (i === 2 ? c(7200, 12.5, 14.5, 12, 14.4) : x));
      const zone = bullZone(noStar)(detect);
      expect(zone).toMatchObject({ top: 14.5, bottom: 13 });
      expect(zone.drawStartTime).toBeUndefined();
    });

    it(`${name}: Session-Low allein erweitert, sobald die Session vor der Erkennung endete`, () => {
      const noStar = morningStar.map((x, i) => (i === 2 ? c(7200, 12.5, 14.5, 12, 14.4, { sessionLowKnownAt: 10800 }) : x));
      expect(bullZone(noStar)(detect)).toMatchObject({ bottom: 12, drawStartTime: 7200 });
      const later = noStar.map((x, i) => (i === 2 ? { ...x, sessionLowKnownAt: 18000 } : x));
      expect(bullZone(later)(detect)).toMatchObject({ bottom: 13 });
    });

    it(`${name}: Evening Star erweitert die Oberkante bärisch`, () => {
      const mirror = morningStar.map((x) => c(x.time, 100 - x.open, 100 - x.low, 100 - x.high, 100 - x.close));
      expect(detect(mirror, '1H', false, 1).find((z) => z.dir === -1)).toMatchObject({ bottom: 85.5, top: 88, drawStartTime: 7200 });
    });

    it(`${name}: M5 bleibt unverändert`, () => {
      expect(detect(morningStar, '5m', true, 0).find((z) => z.dir === 1).drawStartTime).toBeUndefined();
    });
  }
});
