// Einzelfall DR #148 / Position 177 (GBPUSD Short 01.10.2026, Entry 15:14 Berlin): bullische Kräfte am Entry (FVG-Anti-Confluence
// R1–R6), bärischer protected P2-LH und SL-Simulation. Nur lokale Kerzen aus sammle.mjs, keine DB. Schreibt fall-dr148.json.
// Aufruf über Vite-SSR, weil die Marktstruktur (marketStructureAnalysis.ts) TypeScript ist.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../..', import.meta.url)).replace(/[\\/]$/, '');
let envDir = root;
while (!existsSync(path.join(envDir, '.env')) && path.dirname(envDir) !== envDir) envDir = path.dirname(envDir);
const server = await createServer({ root, envDir, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' });
try {
  const L = p => server.ssrLoadModule(p);
  const [{ structureInWindow }, { collectNestedChain, pivotTimeOf }, { detectOrderBlocks }, { detectLiquidityLevels }, { wilderAtrValues },
    { markIgnoredCandles, sessionFromRow }, { berlinOffsetMinutes, formatDatedTime }, { FOREX_MIN_FVG_PIPS }] = await Promise.all(['/src/dobM5Trend.js',
    '/src/marketStructureAnalysis.ts', '/src/orderBlockDetection.js', '/src/liquidityDetection.js', '/src/atr.js', '/src/sessionOccurrences.js',
    '/src/berlinTime.js', '/src/instrumentConfig.js'].map(L));
  const data = path.join(envDir, 'local-data', 'lq2-sweeps');
  const input = JSON.parse(await fs.readFile(path.join(data, 'input.json'), 'utf8'));
  const raw = JSON.parse(await fs.readFile(path.join(data, 'candles', `GBPUSD-5m-${input.from}-${input.to}.json`), 'utf8'));
  const tz = s => berlinOffsetMinutes(s * 1000);
  const m5 = markIgnoredCandles(raw, input.sessions.filter(s => s.instrument === 'GBPUSD').map(sessionFromRow), tz);
  const B = t => { const s = formatDatedTime(t); return `${s.slice(8, 10)}.${s.slice(5, 7)}. ${s.slice(11)}`; };
  const PIP = 0.0001, ENTRY = 1.3223, SL = 1.32292, TP_JOURNAL = 1.31923, TP_DOB = 1.32106, INVALID = 1.3266;
  const entryTime = Date.parse('2026-10-01T13:14:00Z') / 1000, at = Date.parse('2026-10-01T13:10:00Z') / 1000; // letzte geschlossene M5 vor Entry
  const OB = { top: 1.3232, bottom: 1.32274, start: Date.parse('2026-10-01T13:00:00Z') / 1000 };
  const closed = (c, dur) => c.filter(x => x.time + dur <= at);
  const agg = (c, dur) => { const o = []; for (const x of c) { const t = Math.floor(x.time / dur) * dur, l = o.at(-1);
    if (l?.time === t) { l.high = Math.max(l.high, x.high); l.low = Math.min(l.low, x.low); l.close = x.close; } else o.push({ ...x, time: t }); } return o; };
  const tf = { '5m': [m5, 300], '15M': [agg(m5, 900), 900], '1H': [agg(m5, 3600), 3600] };
  const h1 = closed(tf['1H'][0], 3600), atr = wilderAtrValues(h1, 14).at(-1);
  const dist = p => ({ pips: +((ENTRY - p) / PIP).toFixed(1), atr: +((ENTRY - p) / atr).toFixed(2) });
  const since = at - 2 * 86400; // Kräfte der letzten zwei Tage

  // Variante A: bullische FVGs (c[i].low > c[i-2].high), noch nicht vollständig durchlaufen (kein Tief unter der Unterkante bis Entry).
  const fvgs = [];
  for (const [name, [all, dur]] of Object.entries(tf)) {
    const c = closed(all, dur).filter(x => !x.ignored), min = FOREX_MIN_FVG_PIPS[name] * PIP;
    for (let i = 2; i < c.length; i++) {
      const bottom = c[i - 2].high, top = c[i].low;
      if (c[i].time < since || top - bottom < min) continue;
      const killed = c.slice(i + 1).some(x => x.low < bottom), minLow = Math.min(...c.slice(i + 1).map(x => x.low), Infinity);
      if (!killed && bottom < ENTRY && top > TP_JOURNAL - 20 * PIP)
        fvgs.push({ tf: name, zeit: B(c[i - 1].time), unten: +bottom.toFixed(5), oben: +top.toFixed(5), angelaufen: minLow <= top,
          ...dist(top), direktUnterEntryOb: OB.bottom - top <= 3 * PIP });
    }
  }
  // Variante B: bullische OBs (M5/M15/1H), bis Entry nicht berührt und nicht invalidiert, zwischen TP und Entry bzw. unter dem Entry-OB.
  const obs = [];
  for (const [name, [all, dur]] of Object.entries(tf)) {
    for (const z of detectOrderBlocks(closed(all, dur), name, true)) {
      if (z.dir !== 1 || z.startTime < since) continue;
      const state = z.invalidated ? 'invalidiert' : z.touched ? 'getestet' : 'ungetestet';
      if (z.bottom < ENTRY && z.top > TP_JOURNAL - 20 * PIP && state !== 'invalidiert')
        obs.push({ tf: name, zeit: B(z.startTime), unten: +z.bottom.toFixed(5), oben: +z.top.toFixed(5), status: state, ...dist(z.top),
          entryImOb: z.bottom <= ENTRY && ENTRY <= z.top });
    }
  }
  // Bullische LQ-Sweeps: gesweepte M5-Tiefs (P5) der letzten zwei Tage zwischen TP und Entry. Sauber gebrochen = Schluss darunter bis Entry.
  const c5 = closed(m5, 300).filter(x => !x.ignored), lows = detectLiquidityLevels(c5, 5).lows;
  const sweeps = lows.filter(l => l.touched && l.pivotTime >= since && l.price < ENTRY && l.price > TP_JOURNAL - 20 * PIP).map(l => {
    const after = c5.filter(x => x.time >= l.touchedTime), sweepLow = Math.min(...after.slice(0, 6).map(x => x.low));
    const broken = after.some(x => x.close < sweepLow);
    return { zeit: B(l.pivotTime), preis: l.price, sweep: B(l.touchedTime), sweepTief: sweepLow, ...dist(l.price), sauberGebrochen: broken };
  });
  const untouchedLows = lows.filter(l => !l.touched && l.pivotTime >= since && l.price < ENTRY).map(l => ({ zeit: B(l.pivotTime), preis: l.price, ...dist(l.price) }));

  // Marktstruktur P5/P2 wie DOB-v3 (24 h-Fenster, wachsend): protected-high-Pivots der Kette über dem Entry.
  let state = null, windowDays = 0;
  for (let d = 1; d <= 7 && !state; d++) { const s = structureInWindow(m5, at, d * 86400)?.state; if (s && s.trend !== 'unknown') { state = s; windowDays = d; } }
  const chain = state ? collectNestedChain(state) : [];
  const protectedHighs = chain.flatMap((lvl, depth) => [...(lvl.structurePivots ?? []), ...(lvl.innerStructurePivots ?? [])]
    .filter(p => p.type === 'protected-high' && p.price > ENTRY).map(p => ({ ebene: depth, trend: lvl.trend, zeit: B(pivotTimeOf(p)), preis: p.price })));
  const p2Highs = detectLiquidityLevels(c5, 2).highs.filter(h => h.pivotTime >= at - 86400 && h.price > ENTRY && h.price < INVALID)
    .map(h => ({ zeit: B(h.pivotTime), preis: h.price, berührtBisEntry: h.touched && h.touchedTime <= at }));

  // SL-Simulation ab der Entry-Kerze (13:10 UTC, Entry 13:14): SL vor TP, bei gleicher Kerze konservativ SL.
  const after = m5.filter(x => x.time >= at && !x.ignored);
  const sim = (sl, tp) => { for (const x of after) { if (x.high >= sl) return { ergebnis: 'SL', zeit: B(x.time) }; if (x.low <= tp) return { ergebnis: 'TP', zeit: B(x.time) }; } return { ergebnis: 'offen' }; };
  const maxHigh = (from, to) => Math.max(...after.filter(x => x.time >= from && x.time < to).map(x => x.high));
  const tpTime = after.find(x => x.low <= TP_JOURNAL)?.time;
  const candidates = [{ name: 'Journal/DOB-SL', sl: SL }, ...protectedHighs.map(p => ({ name: `protected-high ${p.zeit} (Ebene ${p.ebene})`, sl: p.preis + 0.5 * PIP })),
    ...p2Highs.filter(h => !h.berührtBisEntry).map(h => ({ name: `P2-Hoch ${h.zeit}`, sl: h.preis + 0.5 * PIP })), { name: 'Invalidierung', sl: INVALID }];
  const slTests = candidates.map(c => ({ ...c, sl: +c.sl.toFixed(5), risikoPips: +((c.sl - ENTRY) / PIP).toFixed(1),
    zielJournal: { ...sim(c.sl, TP_JOURNAL), R: +((ENTRY - TP_JOURNAL) / (c.sl - ENTRY)).toFixed(2) },
    zielDob: { ...sim(c.sl, TP_DOB), R: +((ENTRY - TP_DOB) / (c.sl - ENTRY)).toFixed(2) } }));

  const out = { fall: 'DR #148 / Position 177', entry: { zeit: '01.10. 15:14', preis: ENTRY, sl: SL, tpJournal: TP_JOURNAL, tpDob: TP_DOB }, h1Atr: +(atr / PIP).toFixed(1),
    entryOb: { zeit: B(OB.start), unten: OB.bottom, oben: OB.top }, struktur: { trend: state?.trend ?? null, fensterTage: windowDays, ebenen: chain.map(l => l.trend) },
    hochNachEntryBisTp: tpTime ? { preis: maxHigh(at, tpTime), tpErreicht: B(tpTime) } : null,
    fvgs, obs, sweeps, ungesweepteTiefs: untouchedLows, protectedHighs, p2Highs, slTests,
    kerzen: m5.filter(x => x.time >= at - 6 * 3600 && x.time <= at + 5 * 3600).map(x => [x.time, x.open, x.high, x.low, x.close]) };
  await fs.writeFile(path.join(root, 'analysis', 'lq2-sweeps', 'fall-dr148.json'), JSON.stringify(out, null, 1));
  const { kerzen, ...print } = out;
  console.log(JSON.stringify(print, null, 1));
} finally { await server.close(); }
