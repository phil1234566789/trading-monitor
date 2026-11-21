import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectOrderBlocks as frontend } from '../src/orderBlockDetection.js';
import { detectOrderBlocks as backend } from '../supabase/functions/_shared/orderBlocks.ts';
import { detectOrderBlocks as mcp } from '../supabase/functions/trading-monitor-mcp/orderBlockDetection.js';
import { obMinimum } from '../supabase/functions/_shared/instrumentConfig.js';
import { htfObCandles, markIgnoredCandles, sessionFromRow } from '../src/sessionOccurrences.js';
import { dobPoiContext } from '../src/dobHtfObPoi.js';
import { berlinOffsetMinutes } from '../src/berlinTime.js';

// Chart (ob_zones aus poi-watcher) und jeder Alarm-/Lauf-Pfad müssen OBs mit denselben Parametern erkennen.
// Die DOB-POI lief mit isForex=false und ohne Session-Kanten, also mit der 0,05-%-Schwelle statt 1 Pip:
// Philip sah einen POI im Chart, den der Alarm nicht kannte. Vorbild: supabaseRowCapGuard.test.js.
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCAN_DIRS = ['src', 'supabase/functions', 'scripts'];
const DETECTORS = /\b(detectOrderBlocks|createSharedOrderBlockDetector|createIncrementalOrderBlockDetector)\(/g; // ohne Leerzeichen: "detectOrderBlocks (…)" in Prosa zählt nicht

// Aufrufe OHNE obMinimum(...) je Datei. Jeder ist begründet; ein neuer Aufruf macht den Test rot, bis er
// obMinimum nutzt oder hier mit Grund steht. M1/M5 dürfen den Default nehmen: obMinimum ist für Forex dort
// bewusst null (Konfig-Fingerprints), der Default liest dieselbe FOREX_MIN_FVG_PIPS, und Gold-Lücken sind
// ≥ 0,01 USD, also über jedem Pip-Default (siehe Verhaltenstest unten).
const ALLOWED = {
  'src/countertrendEntryPattern1.js': [2, 'M5-Default'],
  'src/countertrendScan.js': [1, 'reicht isForex/minGapOverride des Aufrufers durch'],
  'src/m1FvgEntrySelection.js': [1, 'M1, Schwelle kommt als Parameter'],
  'src/m1Retest.js': [1, 'M1-Default wie Chart-M1'],
  'src/priceChartObZones.js': [2, 'Chart selbst: M1-Default, M5 mit m5MinGap-Parameter'],
  'src/sharedOrderBlocks.js': [2, 'reicht Parameter durch'],
  'src/tradeSetup.js': [1, 'detectSetupObs, Schwelle kommt als Parameter (Aufrufer nutzen obMinimum)'],
  'src/sweepRetestSources.js': [1, 'instrumentConfig(instrument).minFvg = obMinimum'],
  'supabase/functions/trading-monitor-mcp/tools/dataExport.ts': [1, 'M5-Default, Funktion kennt das Instrument nicht'],
  'scripts/setup2PerformancePrimitives.mjs': [1, 'Laufzeitmessung, keine Erkennung für Alarme'],
};

function blankComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length));
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, out); }
    else if (/\.(js|ts|vue|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

const sources = () => SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)))
  .map((f) => [relative(ROOT, f).split('\\').join('/'), blankComments(readFileSync(f, 'utf8'))]);

function callArgs(src, open) {
  let j = open, depth = 1;
  for (; j < src.length && depth > 0; j++) { if (src[j] === '(') depth++; else if (src[j] === ')') depth--; }
  return src.slice(open, j - 1);
}

it('jeder OB-Erkennungsaufruf nimmt die Schwelle aus obMinimum oder ist begründet', () => {
  const counts = {}, samples = {};
  for (const [rel, src] of sources()) {
    for (const m of src.matchAll(DETECTORS)) {
      if (/function\s+$/.test(src.slice(Math.max(0, m.index - 12), m.index))) continue;
      const args = callArgs(src, m.index + m[0].length);
      if (/obMinimum\(/.test(args)) continue;
      counts[rel] = (counts[rel] ?? 0) + 1;
      (samples[rel] ??= []).push(args.replace(/\s+/g, ' ').slice(0, 80));
    }
  }
  const wrong = Object.keys({ ...counts, ...ALLOWED }).filter((f) => (counts[f] ?? 0) !== (ALLOWED[f]?.[0] ?? 0))
    .map((f) => `${f}: ${counts[f] ?? 0} Aufrufe ohne obMinimum, erlaubt ${ALLOWED[f]?.[0] ?? 0}  ${JSON.stringify(samples[f] ?? [])}`);
  expect(wrong).toEqual([]);
});

// Session-Kanten der HTF-OBs (htfObCandles) brauchen high_low_relevant. dob-watcher und der DOB-Kerzencache
// lasen es nicht, ihre H1/H4-OBs hatten deshalb nie eine Session-Kante. Nur Leser ohne OB-Bezug dürfen fehlen.
const SESSION_READS_WITHOUT_HIGH_LOW = new Set([
  'src/views/DobStatistik.vue',                                    // Anzeige der Session-Bänder
  'supabase/functions/poi-watcher/index.ts',                       // danger-Liste für Alarmtexte
  'supabase/functions/_shared/ignoredCandles.ts',                  // Ignore-Fenster; Extreme lädt fetchHighLowSessions
  'supabase/functions/trading-monitor-mcp/scripts/rsiDivergenceStats.ts', // RSI-Statistik, keine OBs
  'scripts/dobConfigTrades.mjs',                                   // nur Session-Label je Trade
]);

it('jede sessions-Abfrage mit OB-Bezug liest high_low_relevant', () => {
  const missing = [];
  for (const [rel, src] of sources()) {
    for (const m of src.matchAll(/\.from\(\s*["'`]sessions["'`]\s*\)\s*\.\s*select\(/g)) {
      const args = callArgs(src, m.index + m[0].length);
      if (/high_low_relevant|SESSION_ROW_COLUMNS/.test(args) || SESSION_READS_WITHOUT_HIGH_LOW.has(rel)) continue;
      missing.push(`${rel}: ${args.trim()}`);
    }
  }
  expect(missing).toEqual([]);
});

const offset = (sec) => berlinOffsetMinutes(sec * 1000);
const sessionsFor = (instrument) => [
  { label: 'Asia', from_minutes: 0, to_minutes: 420, high_low_relevant: true },
  { label: 'NY', from_minutes: 840, to_minutes: 1320, high_low_relevant: true },
  { label: 'Spread Hour', from_minutes: 1380, to_minutes: 0, high_low_relevant: true, ignore_liquidity: true },
].map((r) => ({ ...sessionFromRow({ days: null, ...r }), instrument }));

// Deterministischer Zufallsweg mit kleinen und großen Lücken, damit Schwellenunterschiede sichtbar werden.
function series(start, base, step, bar, n) {
  let seed = 7, price = base;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: n }, (_, i) => {
    const open = price, close = price + (rnd() - 0.48) * step * 8;
    price = close;
    return { time: start + i * bar, open, close, high: Math.max(open, close) + rnd() * step * 2, low: Math.min(open, close) - rnd() * step * 2 };
  });
}

const key = (z) => `${z.dir}:${z.startTime}:${z.top}:${z.bottom}`;
const START = Date.parse('2026-09-01T00:00:00Z') / 1000;

describe.each([['EURUSD', 1.1, 0.0003], ['GBPUSD', 1.3, 0.0004], ['XAUUSD', 2600, 3]])('%s', (instrument, base, step) => {
  const sessions = sessionsFor(instrument);
  const prepare = (rows) => htfObCandles(markIgnoredCandles(rows, sessions, offset), sessions, offset);

  it.each([['1H', 3600], ['4H', 14400], ['15M', 900]])('%s: alle drei Kopien und jedes isForex liefern mit obMinimum dieselben OBs', (tf, bar) => {
    const rows = prepare(series(START, base, step * Math.sqrt(bar / 3600), bar, 600)), min = obMinimum(instrument, tf);
    const reference = backend(rows, tf, true, min).map(key); // poi-watcher → ob_zones → Chart
    expect(reference.length).toBeGreaterThan(5);
    for (const detect of [frontend, backend, mcp]) for (const isForex of [true, false]) expect(detect(rows, tf, isForex, min).map(key)).toEqual(reference);
    if (instrument !== 'XAUUSD') expect(frontend(rows, tf, true).map(key)).toEqual(reference); // Forex-Default = obMinimum
  });

  it('DOB-POI erkennt H1/H4 genau wie poi-watcher', () => {
    const h1 = series(START, base, step, 3600, 600), h4 = series(START, base, step * 2, 14400, 300);
    const htfCandles = { '1h': prepare(h1), '4h': prepare(h4) };
    const { zones } = dobPoiContext({ htfCandles, instrument });
    for (const [tf, rows] of [['H1', htfCandles['1h']], ['H4', htfCandles['4h']]]) {
      const label = tf === 'H1' ? '1H' : '4H';
      // Die letzte Zone hat noch keine Erkennungszeit (Folgekerze fehlt), dobPoiContext lässt sie bewusst weg.
      const expected = backend(rows, label, true, obMinimum(instrument, label)).filter((z) => z.startTime < rows.at(-2).time).map(key);
      expect(zones.filter((z) => z.tf === tf).map(key)).toEqual(expected);
    }
  });
});

// 20.11.2026 06:00 Berlin: bullischer EURUSD-1H-OB mit 1,3-Pip-FVG, im Chart sichtbar, der DOB-POI unbekannt.
it('DOB-POI findet den EURUSD-1H-OB vom 20.11. 06:00', () => {
  const t = (iso) => Date.parse(iso) / 1000;
  const h1 = [
    { time: t('2026-11-20T03:00:00Z'), open: 1.09705, high: 1.09769, low: 1.09686, close: 1.09755 },
    { time: t('2026-11-20T04:00:00Z'), open: 1.09755, high: 1.09799, low: 1.09737, close: 1.09799 },
    { time: t('2026-11-20T05:00:00Z'), open: 1.09799, high: 1.0981, low: 1.09751, close: 1.09779 },
    { time: t('2026-11-20T06:00:00Z'), open: 1.09779, high: 1.09886, low: 1.09776, close: 1.09847 },
    { time: t('2026-11-20T07:00:00Z'), open: 1.09847, high: 1.09896, low: 1.09823, close: 1.09836 },
    { time: t('2026-11-20T08:00:00Z'), open: 1.09836, high: 1.0987, low: 1.0983, close: 1.0985 },
  ];
  const { zones } = dobPoiContext({ htfCandles: { '1h': h1 }, instrument: 'EURUSD' });
  expect(zones).toContainEqual(expect.objectContaining({ tf: 'H1', side: 'long', top: 1.0981, bottom: 1.09776, startTime: t('2026-11-20T06:00:00Z') }));
});
