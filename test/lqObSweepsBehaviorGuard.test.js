import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { markIgnoredCandles, sessionFromRow } from '../src/sessionOccurrences.js';
import { berlinOffsetMinutes } from '../src/berlinTime.js';
import { setup1Inputs, detectSetup1, setup1H1Structure, setup1H1Levels, setup1ObLiquidityLevels, TRADE_SETUP_M5_CANDLE_COUNT } from '../src/setup1Detection.js';
import { TRADE_SETUP_OB_SWEEP_PROFILE } from '../src/tradeSetup.js';
import { filterTradeSetup11Candidates } from '../src/tradeSetup11.js';

// Die OB-Kanten-Quellen zogen aus der Setup-Pipeline in den LQ-Algo (liquidityDetection.js). Setup-1- und
// TS1.1-Urteile müssen dabei auf echten Kerzen gleich bleiben: der Sollstand in
// fixtures/lq-ob-sweeps-behavior.json entstand mit dem Code VOR dem Umzug. Bricht er, hat sich Verhalten geändert.
const rows = (list) => list.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
const sec = (iso) => Date.parse(iso) / 1000;
const DAYS = ['2026-11-12', '2026-11-13', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20'];

const summary = (s) => [s.dir, s.obStartTime, s.obTop, s.obBottom, s.obFvg, s.pathType, s.ls.price, s.ls.pivotTime, s.ls.touchedTime,
  s.ls.sourceKind ?? null, s.sweeps.map((sw) => [sw.timeframe, sw.level.price, sw.level.pivotTime, sw.level.touchedTime, sw.level.sourceKind ?? null]),
  (s.confirmationHistory ?? []).map((h) => [h.sourceKey, h.status, h.reason ?? null, h.validUntil ?? null])];

function behavior(name) {
  const f = JSON.parse(readFileSync(new URL(`fixtures/setup1-parity/${name}-2026-11-20.json`, import.meta.url), 'utf8'));
  const sessions = f.sessions.map((r) => ({ ...sessionFromRow(r), instrument: f.instrument }));
  const mark = (c) => markIgnoredCandles(c, sessions, (s) => berlinOffsetMinutes(s * 1000));
  const m5All = rows(f.m5), h1All = rows(f.h1), d1 = rows(f.d1), sessionConfigs = f.sessions.map(sessionFromRow);
  const structureStartAt = (t) => {
    const known = f.pivots.filter((p) => sec(p.created_at) <= t).sort((a, b) => sec(b.pivot_time) - sec(a.pivot_time))[0];
    return known ? sec(known.structure_start_time) : null;
  };
  const out = {};
  for (const day of DAYS) {
    const dayStart = sec(`${day}T00:00:00Z`), dayEnd = dayStart + 86400;
    const setup1 = new Map(), ts11 = new Map();
    // Stündlich über den Tag, wie die Läufe von Chart-Poll und poi-watcher (dort 15 min; stündlich hält den Test schnell).
    for (let t = dayStart + 3600; t <= dayEnd; t += 3600) {
      const m5 = mark(m5All.filter((c) => c.time + 300 <= t).slice(-TRADE_SETUP_M5_CANDLE_COUNT));
      const h1 = mark(h1All.filter((c) => c.time + 3600 <= t));
      if (m5.length < 50) continue;
      const { highs, lows } = setup1H1Levels(setup1H1Structure(h1, { nowSec: t, structureStartSec: structureStartAt(t) }));
      const plain = detectSetup1(setup1Inputs(f.instrument, m5), highs, lows);
      for (const s of [...plain.shorts, ...plain.longs]) if (!setup1.has(`${s.dir}:${s.obStartTime}`)) setup1.set(`${s.dir}:${s.obStartTime}`, summary(s));
      const typed = detectSetup1(setup1Inputs(f.instrument, m5, { sweepSourceProfile: TRADE_SETUP_OB_SWEEP_PROFILE }), highs, lows);
      for (const s of [...typed.shorts, ...typed.longs])
        if (s.obStartTime >= dayStart && !ts11.has(`${s.dir}:${s.obStartTime}`)) ts11.set(`${s.dir}:${s.obStartTime}`, { ...s, instrument: f.instrument });
    }
    const evaluatedAt = Math.min(dayEnd, f.evaluatedAt);
    const verdicts = filterTradeSetup11Candidates({ instrument: f.instrument, m5Candles: m5All.filter((c) => c.time + 300 <= evaluatedAt),
      h1Candles: h1All.filter((c) => c.time + 3600 <= evaluatedAt), d1Candles: d1.filter((c) => c.time + 86400 <= evaluatedAt), evaluatedAt,
      settings: {}, sessionConfigs, setups: [...ts11.values()], sweepSourceProfile: TRADE_SETUP_OB_SWEEP_PROFILE });
    out[day] = {
      setup1: [...setup1.values()],
      ts11: [...ts11.values()].map(summary),
      ts11Verdicts: verdicts.assessments.map((a) => [a.setup.dir, a.setup.obStartTime, a.status, a.reason ?? null]),
    };
  }
  return out;
}

describe.each(['gbpusd', 'eurusd', 'xauusd'])('%s: Setup 1 und TS1.1 unverändert nach dem LQ-Umzug', (name) => {
  it('gleiche Setups, Sweeps und TS1.1-Urteile wie vor dem Umzug', async () => {
    const result = behavior(name);
    const days = Object.values(result);
    // Ohne OB-Kanten-Sweeps und bestandene Urteile wäre der Vergleich zahnlos.
    expect(days.flatMap((d) => d.ts11).some((s) => s[9] === 'orderBlock' || s[10].some((sw) => sw[4] === 'orderBlock'))).toBe(true);
    await expect(JSON.stringify(result, null, 1)).toMatchFileSnapshot(`./fixtures/lq-ob-sweeps-behavior/${name}.json`);
  }, 300_000);
});

// Chart = Alarm: der Toggle „OB Sweeps“ zeigt genau die OB-Kanten, mit denen TS1.1 rechnet.
it.each(['gbpusd', 'eurusd', 'xauusd'])('%s: OB Sweeps im Chart enthalten jede OB-Kante der TS1.1-Setups', (name) => {
  const f = JSON.parse(readFileSync(new URL(`fixtures/setup1-parity/${name}-2026-11-20.json`, import.meta.url), 'utf8'));
  const sessions = f.sessions.map((r) => ({ ...sessionFromRow(r), instrument: f.instrument }));
  const m5 = markIgnoredCandles(rows(f.m5).filter((c) => c.time + 300 <= f.evaluatedAt).slice(-TRADE_SETUP_M5_CANDLE_COUNT), sessions, (s) => berlinOffsetMinutes(s * 1000));
  const typed = detectSetup1(setup1Inputs(f.instrument, m5, { sweepSourceProfile: TRADE_SETUP_OB_SWEEP_PROFILE }), [], []);
  const used = [...typed.shorts, ...typed.longs].flatMap((s) => (s.confirmationHistory ?? []).map((h) => h.level)).filter((l) => l.sourceKind === 'orderBlock');
  const chart = setup1ObLiquidityLevels(f.instrument, m5);
  expect(used.length).toBeGreaterThan(0);
  for (const level of used) expect(chart).toContainEqual(level);
});
