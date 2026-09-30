import { describe, expect, it } from 'vitest';
import { scanTradeSetup2Window, m1ScanPrefix } from '../src/tradeSetup2Scan.js';
import { buildM1Structure } from '../src/m1Structure.js';
import h1 from './fixtures/gbpusd-h1-dr114-lifecycle.json';
import m5 from './fixtures/gbpusd-m5-dr114-close-reaction.json';
import m1 from './fixtures/gbpusd-m1-dr114-p5.json';
import config from './fixtures/gbpusd-m5-dr114-session-targets.json';

const at = clock => Date.parse(`2026-09-09T${clock}:00+02:00`) / 1000;
const input = { instrument: 'GBPUSD', h1Candles: h1.candles, m5Candles: m5, m1Candles: m1,
  settings: { rangesFixedStartActive: true, rangesFixedStartTime: h1.cutoff }, sessionConfigs: config.sessions,
  fromTime: at('09:25'), toTime: at('09:55') };

describe('chronological Trade Setup 2.0 scan', () => {
  it('finds DR114 exactly once at its first knowable entry, independent of future candles', async () => {
    const full = await scanTradeSetup2Window(input);
    const entries = full.filter(s => s.entry);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ knownAt: at('09:50'), entry: { price: 1.35615 } });
    const prefix = await scanTradeSetup2Window({ ...input, toTime: at('09:50'),
      m1Candles: m1.filter(c => c.time + 60 <= at('09:50')) });
    expect(prefix.filter(s => s.entry)).toEqual(entries);
    expect((await scanTradeSetup2Window({ ...input, toTime: at('09:49') })).filter(s => s.entry)).toEqual([]);
  }, 30000);
  it('supports interruption before scanning and rejects reversed windows', async () => {
    const signal = AbortSignal.abort();
    await expect(scanTradeSetup2Window({ ...input, signal })).rejects.toMatchObject({ name: 'AbortError' });
    await expect(scanTradeSetup2Window({ ...input, fromTime: input.toTime + 1 })).rejects.toThrow();
  });
  it('retains actual P5 warmup across a long ignored session', () => {
    const rows = Array.from({ length: 130 }, (_, i) => ({ time: i * 60, open: 1, close: 1,
      high: 2 + Math.sin(i), low: 0.5, ignored: i >= 30 && i < 90 }));
    const anchor = { pivotTime: 90 * 60, recognizedAt: 95 * 60 };
    const full = buildM1Structure(rows, anchor, 130 * 60);
    const prefix = m1ScanPrefix(rows, anchor.pivotTime, rows.length);
    expect(prefix.filter(c => c.time < anchor.pivotTime && !c.ignored).length).toBeGreaterThanOrEqual(11);
    expect(prefix.filter(c => c.ignored)).toHaveLength(60);
    expect(buildM1Structure(prefix, anchor, 130 * 60)).toEqual(full);
    expect(full.status).toBe('ready');
  });
});
