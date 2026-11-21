import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { markIgnoredCandles, sessionFromRow } from '../src/sessionOccurrences.js';
import { berlinOffsetMinutes } from '../src/berlinTime.js';
import { computeRangesPivots } from '../src/marketStructureAnalysis.ts';
import { createChartStructureCalculator } from '../src/chartStructureCalculation.js';
import { collectStructureLqLevels } from '../src/marketStructureRendering';
import { fmtDateTime } from '../src/format.js';
import { RANGES_CANDLE_BUFFER } from '../src/priceChartConstants.js';
import { detectLiquidityLevels as frontendFractals } from '../src/liquidity.js';
import { setup1Inputs, detectSetup1, TRADE_SETUP_M5_CANDLE_COUNT } from '../src/setup1Detection.js';
import { TRADE_SETUP_OB_SWEEP_PROFILE } from '../src/tradeSetup.js';
import { filterTradeSetup11Candidates } from '../src/tradeSetup11.js';
import { tradeSetupToRow } from '../src/tradeSetupRow.js';
import { computeTs11Verdicts } from '../supabase/functions/_shared/ts11Verdicts.ts';
import { detectLiveSetup1 } from '../supabase/functions/_shared/setup1Live.ts';
import { markIgnored as backendMarkIgnored } from '../supabase/functions/_shared/ignoredCandles.ts';
import { detectLiquidityLevels as backendFractals } from '../supabase/functions/_shared/liquidity.ts';
import { TRADE_SETUP_M5_CANDLE_LIMIT } from '../supabase/functions/poi-watcher/forexBatch.ts';

// Philips Regel: Chart und Alarm erkennen gleich. Seit dem 28.07. nahm der Chart die H1-LS aus der
// Marktstruktur, poi-watcher/get_data_snapshot aus rohen Periode-10-Fraktalen und nur das neueste Setup —
// kein Test hat es bemerkt. Teil (a) rechnet beide Seiten auf echten FXCM-Kerzen (20.11.2026), Teil (b)
// hält jeden Aufrufer an der gemeinsamen Pipeline (src/setup1Detection.js). Vorbild: obDetectionParityGuard.

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const rows = (list) => list.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
const sec = (iso) => Date.parse(iso) / 1000;
const fixtures = ['gbpusd', 'eurusd', 'xauusd'].map((name) =>
  JSON.parse(readFileSync(new URL(`fixtures/setup1-parity/${name}-2026-11-20.json`, import.meta.url), 'utf8')));

// Strukturstart, den beide Seiten zum Zeitpunkt t aus daily_structure_pivots lesen (live: neuester Pivot).
const structureStartAt = (f, t) => {
  const known = f.pivots.filter((p) => sec(p.created_at) <= t).sort((a, b) => sec(b.pivot_time) - sec(a.pivot_time))[0];
  return known ? sec(known.structure_start_time) : null;
};

// Chart: fetchRangesCandles + computeRangesPivotsAndMetadata + Struktur-Worker + collectStructureLqLevels.
function chartH1Levels(f, h1, t, startSec) {
  const hours = startSec != null ? Math.max(1, Math.ceil((t - startSec) / 3600)) : 168;
  const cutoff = startSec ?? t - 168 * 3600;
  const candles = h1.slice(-(hours + RANGES_CANDLE_BUFFER)).filter((c) => !c.ignored);
  const state = createChartStructureCalculator()({ kind: 'h1', periodOuter: 5, periodInner: 2, candles,
    pivotsOuter: computeRangesPivots(candles, 5, cutoff, fmtDateTime), pivotsInner: computeRangesPivots(candles, 2, cutoff, fmtDateTime) });
  return { highs: collectStructureLqLevels(state, 1), lows: collectStructureLqLevels(state, -1) };
}

const setupKey = (s) => ({ key: `${s.dir}:${s.obStartTime}`, ls: [s.ls.price, s.ls.pivotTime, s.ls.touchedTime],
  sweeps: s.sweeps.map((sw) => `${sw.timeframe}:${sw.level.price}:${sw.level.pivotTime}`), ob: [s.obTop, s.obBottom, s.obFvg] });

describe.each(fixtures)('$instrument 20.11.2026', (f) => {
  const sessionsFront = f.sessions.map((r) => ({ ...sessionFromRow(r), instrument: f.instrument }));
  const sessionsBack = f.sessions.filter((r) => r.ignore_liquidity)
    .map((r) => ({ fromMinutes: r.from_minutes, toMinutes: r.to_minutes, days: r.days, ignoreLiquidity: true }));
  const markFront = (c) => markIgnoredCandles(c, sessionsFront, (s) => berlinOffsetMinutes(s * 1000));
  const m5All = rows(f.m5), h1All = rows(f.h1);
  // Alle 15 Minuten des Handelstags, wie die Läufe der beiden Seiten (Chart-Poll, poi-watcher-Cron).
  const ticks = [];
  for (let t = f.dayStart + 900; t <= f.evaluatedAt; t += 900) ticks.push(t);
  const at = (t) => {
    const m5 = m5All.filter((c) => c.time + 300 <= t).slice(-TRADE_SETUP_M5_CANDLE_COUNT);
    const h1 = h1All.filter((c) => c.time + 3600 <= t);
    return { m5, h1, startSec: structureStartAt(f, t) };
  };

  it('poi-watcher lädt dasselbe M5-Fenster wie der Chart', () => {
    expect(TRADE_SETUP_M5_CANDLE_LIMIT).toBe(TRADE_SETUP_M5_CANDLE_COUNT);
  });

  it('Liquiditäts-Level: Fraktale (M5/1H) und H1-Struktur-Level sind auf beiden Seiten gleich', () => {
    const { m5, h1, startSec } = at(f.evaluatedAt);
    for (const [candles, period] of [[m5, 5], [h1, 5], [m5, 10]])
      expect(backendFractals(backendMarkIgnored(candles, sessionsBack), period)).toEqual(frontendFractals(markFront(candles), period));
    const chart = chartH1Levels(f, markFront(h1), f.evaluatedAt, startSec);
    expect(chart.highs.length + chart.lows.length).toBeGreaterThan(0);
    // Backend-H1-Level sind die, mit denen detectLiveSetup1 rechnet; gleiche Setups über den Tag prüft der nächste Test.
    const { highs, lows } = chart;
    const backend = detectLiveSetup1({ instrument: f.instrument, m5Candles: backendMarkIgnored(m5, sessionsBack),
      h1Candles: backendMarkIgnored(h1, sessionsBack), nowSec: f.evaluatedAt, structureStartSec: startSec, currentPrice: null });
    const front = setup1Inputs(f.instrument, markFront(m5));
    const chartSetups = detectSetup1(front, highs, lows);
    const fresh = [...chartSetups.shorts, ...chartSetups.longs].filter((s) => s.obStartTime >= front.params.nowTime - front.params.maxLookbackSec);
    expect(backend.detected.map(setupKey)).toEqual(fresh.map(setupKey));
  });

  // Gemeinsam für Setup-1- und TS1.1-Vergleich: was beide Seiten über den Tag erstmals erkennen.
  const day = (() => {
    const chart = new Map(), backend = new Map(), backendTs11 = new Map(), chartTs11 = new Map();
    for (const t of ticks) {
      const { m5, h1, startSec } = at(t);
      const h1Front = chartH1Levels(f, markFront(h1), t, startSec);
      const front = setup1Inputs(f.instrument, markFront(m5));
      const all = detectSetup1(front, h1Front.highs, h1Front.lows);
      for (const s of [...all.shorts, ...all.longs])
        if (s.obStartTime >= front.params.nowTime - front.params.maxLookbackSec && !chart.has(`${s.dir}:${s.obStartTime}`)) chart.set(`${s.dir}:${s.obStartTime}`, s);
      const ts11 = detectSetup1(setup1Inputs(f.instrument, markFront(m5), { sweepSourceProfile: TRADE_SETUP_OB_SWEEP_PROFILE }), h1Front.highs, h1Front.lows);
      for (const s of [...ts11.shorts, ...ts11.longs])
        if (s.obStartTime >= f.dayStart && !chartTs11.has(`${s.dir}:${s.obStartTime}`)) chartTs11.set(`${s.dir}:${s.obStartTime}`, { ...s, instrument: f.instrument });
      const live = detectLiveSetup1({ instrument: f.instrument, m5Candles: backendMarkIgnored(m5, sessionsBack),
        h1Candles: backendMarkIgnored(h1, sessionsBack), nowSec: t, structureStartSec: startSec, currentPrice: null });
      for (const s of live.detected) if (!backend.has(`${s.dir}:${s.obStartTime}`)) backend.set(`${s.dir}:${s.obStartTime}`, { s, t });
      for (const s of live.ts11Only) if (!backendTs11.has(`${s.dir}:${s.obStartTime}`)) backendTs11.set(`${s.dir}:${s.obStartTime}`, { s, t });
    }
    return { chart, backend, backendTs11, chartTs11 };
  })();

  it('Setup 1: Chart und poi-watcher melden über den Tag dieselben Setups mit denselben Sweeps', () => {
    expect(day.chart.size).toBeGreaterThan(2);
    expect([...day.backend.values()].map(({ s }) => setupKey(s))).toEqual([...day.chart.values()].map(setupKey));
  });

  it('TS1.1: jeder TS1.1-Kandidat des Charts steht als poi-watcher-Zeile; dob-watcher, Protokoll und MCP urteilen wie der Chart', async () => {
    const d1 = rows(f.d1), sessionConfigs = f.sessions.map(sessionFromRow);
    // Kerzen-Loader wie dob-watcher/MCP: nur geschlossene Kerzen bis evaluatedAt, die letzten `count`.
    const bySec = { '5m': [m5All, 300], '1h': [h1All, 3600], '1D': [d1, 86400] };
    const load = async (bar, count) => bySec[bar][0].filter((c) => c.time + bySec[bar][1] <= f.evaluatedAt).slice(-count);
    const judge = async (stored, createdAt) => {
      const verdicts = await computeTs11Verdicts({ rows: stored.map((x, i) => tradeSetupToRow(x.s, { id: i, instrument: f.instrument, createdAt: createdAt(x) })),
        instrument: f.instrument, evaluatedAt: f.evaluatedAt, sessionConfigs, load });
      return new Map(stored.map(({ s }, i) => [`${s.dir}:${s.obStartTime}`, verdicts.get(i)?.status]));
    };
    // Setup-1-Zeilen plus die TS1.1-only-Zeilen (OB-Sweep-Quellen), die poi-watcher seit 21.11.2026 mitspeichert.
    const stored = [...day.backend.values(), ...day.backendTs11.values()].filter(({ s }) => s.obStartTime >= f.dayStart);
    const watcher = await judge(stored, ({ t }) => t); // created_at = erster poi-watcher-Lauf mit dem Setup
    const snapshot = await judge(stored, ({ s }) => s.obStartTime + 600); // get_data_snapshot: frisch erkannt, ohne Zeile
    const m5 = m5All.filter((c) => c.time + 300 <= f.evaluatedAt);
    const chart = filterTradeSetup11Candidates({ instrument: f.instrument, m5Candles: m5, h1Candles: h1All, d1Candles: d1, evaluatedAt: f.evaluatedAt,
      settings: {}, sessionConfigs, setups: [...day.chartTs11.values()], sweepSourceProfile: TRADE_SETUP_OB_SWEEP_PROFILE });
    const chartStatus = new Map(chart.assessments.map((a) => [`${a.setup.dir}:${a.setup.obStartTime}`, a.status]));
    // Fixture-M5 reicht bis vor den Strukturanker, sonst urteilt TS1.1 nur 'unknown' und der Vergleich wäre leer.
    expect([...chartStatus.values()]).toContain('passed');
    // Jeder Chart-Kandidat muss gespeichert sein; umgekehrt gibt es keine Zeile, die der Chart nicht als TS1.1-Kandidat kennt.
    const keys = [...new Set([...chartStatus.keys(), ...watcher.keys()])].sort();
    const expected = keys.map((k) => [k, chartStatus.get(k) ?? 'nicht im Chart']);
    expect(keys.map((k) => [k, watcher.get(k) ?? 'nicht gespeichert'])).toEqual(expected);
    expect(keys.map((k) => [k, snapshot.get(k) ?? 'nicht gespeichert'])).toEqual(expected);
  });
});

// (b) Quell-Scan: Erkennung nur über die gemeinsame Pipeline. Kommentare zählen nicht.
const SCAN_DIRS = ['src', 'supabase/functions', 'scripts'];
const blankComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length));
const walk = (dir, out = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, out); } else if (/\.(js|ts|vue|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
};
const sources = () => SCAN_DIRS.flatMap((d) => walk(join(ROOT, d))).map((f) => [relative(ROOT, f).split('\\').join('/'), blankComments(readFileSync(f, 'utf8'))]);
const count = (re) => {
  const out = {};
  for (const [rel, src] of sources()) {
    const n = [...src.matchAll(re)].filter((m) => !/function\s+$/.test(src.slice(Math.max(0, m.index - 12), m.index))).length;
    if (n) out[rel] = n;
  }
  return out;
};

it('Setup-1-Erkennung läuft nur über src/setup1Detection.js oder ist begründet', () => {
  // Aufrufe von detectTradeSetups/detectTradeSetup außerhalb der Pipeline. Jeder ist begründet; ein neuer
  // Aufrufer (z.B. eine dritte Alarm-Kopie) macht den Test rot, bis er setup1Inputs/detectSetup1 nutzt.
  const ALLOWED = {
    'src/setup1Detection.js': 2, // die Pipeline selbst
    'supabase/functions/_shared/tradeSetup.ts': 1, // detectTradeSetup = neuestes von detectTradeSetups, nur Analyse-Skripte
    'src/tradeSetup11Debugger.js': 1, // TS1.1-Debugger: native M5-Quellen eines Falls, keine Alarmquelle
    'src/tradeSetup11Projection.js': 1, // TS1.1 rechnet ein gespeichertes Setup auf seinen Erkennungsstand nach
    'src/tradeSetupChecklistReactions.js': 1, // TS2-Checkliste: Reaktionen innerhalb einer schon bestätigten Range
    'supabase/functions/trading-monitor-mcp/scripts/setup1Replay.ts': 1, // Analyse/Backfill, H1-Fraktale P10 (Bericht 21.11.)
  };
  expect(count(/\bdetectTradeSetups?\(/g)).toEqual(ALLOWED);
});

it('Live-Pfade nehmen die H1-LS aus der Marktstruktur, nie aus eigenen H1-Fraktalen', () => {
  const live = (rel) => /^supabase\/functions\/(poi-watcher|dob-watcher|_shared)\/|^supabase\/functions\/trading-monitor-mcp\/(tools\/|[^/]+$)|^src\//.test(rel);
  const hits = Object.keys(count(/\bTRADE_SETUP_H1_FRACTAL_PERIOD\b/g)).filter(live);
  expect(hits).toEqual(['supabase/functions/_shared/tradeSetup.ts']); // nur die Definition (für die Analyse-Skripte)
  const src = Object.fromEntries(sources());
  for (const rel of ['supabase/functions/poi-watcher/index.ts', 'supabase/functions/trading-monitor-mcp/tools/dataSnapshot.ts'])
    expect(src[rel], `${rel} muss detectLiveSetup1 nutzen`).toMatch(/\bdetectLiveSetup1\(/);
  expect(src['src/composables/usePriceChartTradeSetups.js']).toMatch(/\bsetup1Inputs\([\s\S]*\bdetectSetup1\(/);
});

it('Fraktal-Kern und Setup-Konstanten gibt es nur einmal', () => {
  // Die Kaskaden-Fraktalprüfung stand dreimal im Repo (src, _shared/liquidity.ts, _shared/liquidityDetection.ts).
  expect(sources().filter(([, src]) => /function\s+isUpFractal\s*\(/.test(src)).map(([rel]) => rel)).toEqual(['src/liquidityDetection.js']);
  for (const name of ['TRADE_SETUP_M5_FRACTAL_PERIOD', 'LIQUIDITY_FRACTAL_PERIOD'])
    expect(Object.keys(count(new RegExp(`\\b(const|let)\\s+${name}\\s*[=:]`, 'g'))), name).toHaveLength(1);
});

it('Chart-Hinweis "Struktur weicht vom Alarm ab" folgt derselben Konstante wie der Alarm', async () => {
  const { SETUP1_STRUCTURE_SETTINGS, SETUP1_H1_STRUCTURE, structureDeviatesFromAlarm } = await import('../src/setup1Detection.js');
  expect(structureDeviatesFromAlarm({ ...SETUP1_STRUCTURE_SETTINGS })).toBe(false);
  for (const [key, value] of Object.entries({ rangesPeriod: 4, ranges2Period: 3, rangesStartMode: 'days', rangesLookbackHours: 100, ranges2LookbackHours: 100 }))
    expect(structureDeviatesFromAlarm({ ...SETUP1_STRUCTURE_SETTINGS, [key]: value }), key).toBe(true);
  // Der Alarm rechnet mit genau diesen Perioden/dem Lookback (setup1H1Structure), keine zweite Kopie im Dashboard.
  expect([SETUP1_STRUCTURE_SETTINGS.rangesPeriod, SETUP1_STRUCTURE_SETTINGS.ranges2Period]).toEqual([SETUP1_H1_STRUCTURE.periodOuter, SETUP1_H1_STRUCTURE.periodInner]);
  const dashboard = readFileSync(join(ROOT, 'src/views/Dashboard.vue'), 'utf8');
  for (const key of Object.keys(SETUP1_STRUCTURE_SETTINGS))
    expect(dashboard, key).toContain(`useLocalStorageRef("${key}", SETUP1_STRUCTURE_SETTINGS.${key})`);
});

it('TS1.0 ist abgebaut: kein eigener Setup-1-Alarm, Setup-Listen zeigen nur TS1.1-Urteile', () => {
  const src = Object.fromEntries(sources());
  expect(src['src/alarmSettings.js']).not.toMatch(/key:\s*["']trade_setup["']/);
  expect(src['supabase/functions/poi-watcher/index.ts']).not.toMatch(/isAlarmOn\(\s*["']trade_setup["']\s*\)/);
  expect(src['src/alarmLog.js']).toMatch(/trade_setup_ts11_verdicts!inner[\s\S]*status["'],\s*["']passed/);
  expect(src['supabase/functions/trading-monitor-mcp/tools/reads.ts']).toMatch(/getTs11TradeSetups\(/);
  expect(src['supabase/functions/trading-monitor-mcp/tools/dataSnapshot.ts']).toMatch(/passedTs11Setups\(/);
});

// get_trade_setups lief live in den 300-s-MCP-Timeout: fetchForexCandles hielt das Archiv am Wochenende für veraltet
// und lud bis zu 15000 M5 von cTrader nach. Das TS1.1-Urteil darf nur geschlossene FXCM-Kerzen lesen (wie dob-watcher)
// und muss seine Arbeit je Aufruf deckeln.
it('TS1.1-Urteil im MCP: kein Live-Nachladen bei cTrader, Laufzeit gedeckelt', async () => {
  const reach = (start) => {
    const seen = new Set(), todo = [start];
    while (todo.length) {
      const rel = todo.pop();
      if (seen.has(rel)) continue;
      seen.add(rel);
      const src = blankComments(readFileSync(join(ROOT, rel), 'utf8'));
      for (const m of src.matchAll(/(?:from|import)\s*["'](\.{1,2}\/[^"']+)["']/g)) {
        const target = join(rel, '..', m[1]).split('\\').join('/');
        if (/\.(js|ts|mjs)$/.test(target)) todo.push(target);
      }
    }
    return [...seen];
  };
  for (const entry of ['supabase/functions/trading-monitor-mcp/ts11TradeSetups.ts', 'supabase/functions/_shared/ts11Verdicts.ts']) {
    const files = reach(entry);
    expect(files.filter((f) => /forexCandles\.ts$|\/ctrader\//.test(f)), entry).toEqual([]);
    const code = files.map((f) => blankComments(readFileSync(join(ROOT, f), 'utf8'))).join('\n');
    expect(code, entry).not.toMatch(/\bfetchForexCandles\(|\bfetchLiveForexCandles\(|functions\/v1\/forex-candles/);
  }
  const mcp = blankComments(readFileSync(join(ROOT, 'supabase/functions/trading-monitor-mcp/ts11TradeSetups.ts'), 'utf8'));
  expect(mcp).toMatch(/readClosedFxcmCandles\(/);
  const cap = Number(mcp.match(/const MAX_COMPUTED = (\d+);/)?.[1]);
  expect(cap).toBeGreaterThan(0);
  expect(cap).toBeLessThanOrEqual(20);
  expect(mcp).toMatch(/\.slice\(0, MAX_COMPUTED\)/);
  expect(mcp).toMatch(/\.limit\(Math\.min\(500,/);
  const { TS11_CONTEXT } = await import('../supabase/functions/_shared/ts11Verdicts.ts');
  expect(TS11_CONTEXT.maxM5).toBeLessThanOrEqual(15000);
  expect(TS11_CONTEXT.h1).toBeLessThanOrEqual(6000);
});
