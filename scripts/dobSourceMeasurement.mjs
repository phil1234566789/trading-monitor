// Messung, keine Regel: welche Quelle der Kraft ging den einmaligen v0-Trades XAU 2026 voraus, und wie hängt die Winrate davon ab.
// Basis: analysis/dob-setup/winrate-xau-2026-dob-setup-v0.json. Erkennungen unverändert wiederverwendet:
// HTF-OBs wie snapshotIndicatorCalculation (htfObCandles + detectOrderBlocks, Kante aus 081d2d47), Levels aus detectLiquidityLevels.
// Ereigniszeiten auf M5 genau: OB-Touch = erste M5-Kerze ab Erkennung in der Zone, Sweep = erste M5-Kerze in der HTF-Sweepkerze am Level.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createServer } from 'vite';
import { dobCandleCache } from './dobCandleCache.mjs';

const SYMBOL = 'XAUUSD', HOUR = 3600;
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
let envDir = root;
while (!existsSync(path.join(envDir, '.env')) && path.dirname(envDir) !== envDir) envDir = path.dirname(envDir);
const base = JSON.parse(await fs.readFile(path.join(root, 'analysis', 'dob-setup', 'winrate-xau-2026-dob-setup-v0.json'), 'utf8'));

// Mustertrades Konto 8 (Berlin) mit Philips bestätigter Quelle (Status Quo, Reiter Mustertrades).
const SAMPLES = [
  ['#134', '2026-11-12', '14:11', 'short', 'H1-OB'], ['#135', '2026-11-05', '16:14', 'short', 'LS M5'],
  ['#136', '2026-11-04', '04:13', 'long', 'H1-OB'], ['#136b', '2026-11-04', '06:21', 'long', 'H1-OB'],
  ['#137', '2026-11-02', '09:05', 'short', 'LS M5'], ['#138', '2026-10-26', '14:34', 'short', 'LS M5 + alter M5-OB'],
  ['#139', '2026-10-22', '10:52', 'short', 'LS M5/M1 + M5-OB'], ['#139b', '2026-10-22', '11:24', 'short', 'LS M5/M1 + M5-OB'],
  ['#140', '2026-10-22', '05:03', 'short', 'H1-OB + LS Asia-Mid'], ['#140b', '2026-10-22', '05:22', 'short', 'H1-OB + LS Asia-Mid'],
  ['#141', '2026-10-12', '15:34', 'short', 'LS M5'],
];

const server = await createServer({ root, envDir, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const load = p => server.ssrLoadModule(p);
  const [{ fetchInitialCandles }, { supabase }, { markIgnoredCandles, htfObCandles, sessionOccurrences }, { berlinDayRangeUtcMs, berlinOffsetMinutes, berlinDateStrFor },
    { detectOrderBlocks, candleTouchesOrderBlock }, { detectLiquidityLevels, liquidityTouch, LIQUIDITY_FRACTAL_PERIOD },
    { orderBlockRecognitionTimes }, { obMinimum }, { dobLiveWindowStart }, { dobSourceContext, nearestHtfSource, h1AtrAt }] = await Promise.all(['/src/forexCandles.js',
    '/src/supabaseClient.js', '/src/sessionOccurrences.js', '/src/berlinTime.js', '/src/orderBlockDetection.js', '/src/liquidityDetection.js',
    '/src/orderBlockRecognitionTime.js', '/src/instrumentConfig.js', '/src/dobTradeSetup.js', '/src/dobSourceOfStrength.js'].map(load));
  const sec = day => berlinDayRangeUtcMs(day).startUtcMs / 1000;
  const cacheOf = from => dobCandleCache({ outDir: path.join(root, '.debug', 'dob-setup'), symbol: SYMBOL, refresh: false,
    defaultStartSec: sec(from), startSec: sec(from), fetchInitialCandles, supabase });
  // HTF mit sechs Wochen Vorlauf: alte OBs und LS-Alter > 24 h brauchen Historie vor dem 01.01.
  const ltf = cacheOf('2026-01-01'), htf = cacheOf('2025-11-15');
  const sessions = await ltf.sessions(), offset = s => berlinOffsetMinutes(s * 1000);
  const mark = rows => markIgnoredCandles(rows, sessions, offset);
  const m5 = mark(await ltf.candles('5m', 300, 300)), m1 = await ltf.candles('1m', 60, 1500);
  const frames = { '1h': mark(await htf.candles('1h', HOUR, 200)), '4h': mark(await htf.candles('4h', 4 * HOUR, 100)) };

  const lowerBound = (rows, t) => { let lo = 0, hi = rows.length; while (lo < hi) { const m = (lo + hi) >> 1; if (rows[m].time < t) lo = m + 1; else hi = m; } return lo; };
  const firstM5 = (from, to, hit) => { for (let i = lowerBound(m5, from); i < m5.length && m5[i].time < to; i++) if (!m5[i].ignored && hit(m5[i])) return m5[i].time; return null; };

  // Ereignisse: {kind, tf, side (long = Quelle für Long), time, ...}
  const events = [];
  for (const [bar, tf] of [['1h', 'H1'], ['4h', 'H4']]) {
    const input = htfObCandles(frames[bar], sessions, offset), recognized = orderBlockRecognitionTimes(input, bar);
    for (const zone of detectOrderBlocks(input, bar === '1h' ? '1H' : '4H', false, obMinimum(SYMBOL, bar === '1h' ? '1H' : '4H'))) {
      const at = recognized.get(zone.startTime), time = at && firstM5(at, Infinity, c => candleTouchesOrderBlock(c, zone));
      if (time) events.push({ kind: 'ob', tf, side: zone.dir === 1 ? 'long' : 'short', time, top: zone.top, bottom: zone.bottom, startTime: zone.startTime });
    }
  }
  for (const [rows, tf, dur] of [[frames['1h'], 'H1', HOUR], [frames['4h'], 'H4', 4 * HOUR], [m5, 'M5', 300]]) {
    const { highs, lows } = detectLiquidityLevels(rows, LIQUIDITY_FRACTAL_PERIOD);
    for (const level of [...highs, ...lows]) {
      if (!level.touched) continue;
      const time = dur === 300 ? level.touchedTime : firstM5(level.touchedTime, level.touchedTime + dur, c => liquidityTouch(c, level.price, level.dir)) ?? level.touchedTime;
      // Sweep eines Hochs = Quelle für Short, eines Tiefs = für Long.
      events.push({ kind: 'ls', tf, side: level.dir === 1 ? 'short' : 'long', time, price: level.price, pivotTime: level.pivotTime });
    }
  }
  events.sort((a, b) => a.time - b.time);
  const m5Zones = new Map(detectOrderBlocks(m5, '5m', true, obMinimum(SYMBOL, '5m')).map(z => [z.startTime, z]));

  // Einmalige Trades wie in v0 (gleiche Richtung/Entry/SL); Anker = spätester OB1 aller Paare des Trades.
  const trades = new Map();
  for (const s of base.setups) {
    const [, , , ob1, ob2] = s.id.split(':').map(Number), key = `${s.direction}:${s.entryTime}:${s.entryPrice}:${s.stopPrice}`;
    const t = trades.get(key) ?? { ...s, ob1: -Infinity, ob2: -Infinity, pairs: 0 };
    Object.assign(t, { ob1: Math.max(t.ob1, ob1), ob2: Math.max(t.ob2, ob2), pairs: t.pairs + 1, outcome: s.outcome });
    trades.set(key, t);
  }

  const bucket = (v, edges, labels) => labels[edges.findIndex(e => v < e)] ?? labels.at(-1);
  const features = (t, anchor) => {
    const near = m1.slice(lowerBound(m1, anchor - 4 * 86400), lowerBound(m1, anchor + 60));
    const dayStart = Math.max(dobLiveWindowStart(near, SYMBOL, anchor), near[0]?.time ?? anchor);
    const found = events.slice(lowerBound(events, dayStart), lowerBound(events, anchor)).filter(e => e.side === t.direction);
    const kinds = new Set(found.map(e => `${e.kind === 'ob' ? 'OB' : 'LS'} ${e.tf}`));
    const hasOb = found.some(e => e.kind === 'ob'), hasLs = found.some(e => e.kind === 'ls');
    const latest = found.at(-1), lastSweep = found.findLast(e => e.kind === 'ls');
    // Mehrere Levels in derselben Sweep-Kerze: das älteste Pivot ist das gemeinte Level (#137 3915,06, #141 4179,25).
    const latestLs = lastSweep && found.filter(e => e.kind === 'ls' && e.time === lastSweep.time).reduce((a, b) => b.pivotTime < a.pivotTime ? b : a);
    const ob1 = m5Zones.get(t.ob1);
    let proximity = 'keine Quelle';
    if (latest && ob1) {
      const [lo, hi] = latest.kind === 'ob' ? [latest.bottom, latest.top] : [latest.price, latest.price];
      const gap = Math.max(0, lo - ob1.top, ob1.bottom - hi);
      proximity = gap === 0 ? 'in Zone' : gap <= 2 * (ob1.top - ob1.bottom) ? 'nah (≤ 2 OB1-Höhen)' : 'fern';
    }
    return {
      dayStart, category: hasOb && hasLs ? 'LS + OB' : hasOb ? 'nur OB' : hasLs ? 'nur LS' : 'keine', kinds: [...kinds].sort(),
      deltaT: latest ? bucket(anchor - latest.time, [HOUR, 3 * HOUR], ['0–1 h', '1–3 h', '3 h–Marktschluss']) : 'keine Quelle',
      deltaMin: latest ? Math.round((anchor - latest.time) / 60) : null,
      lsAge: latestLs ? bucket(latestLs.time - latestLs.pivotTime, [4 * HOUR, 24 * HOUR], ['< 4 h', '4–24 h', '> 24 h']) : 'kein LS',
      proximity, found, latest: latest && { kind: latest.kind, tf: latest.tf, time: latest.time, price: latest.price ?? null, zone: latest.top != null ? [latest.bottom, latest.top] : null },
    };
  };
  const slim = ({ found, ...f }) => f;
  const rows = [...trades.values()].map(t => ({ ...t, byOb1: features(t, t.ob1), byOb2: features(t, t.ob2) }));
  // Quellenlisten nur für die Mustertrades im Bericht, sonst wird das JSON unnötig groß.
  const sourceList = f => f.found.map(e => ({ kind: e.kind, tf: e.tf, time: e.time, ...(e.kind === 'ob' ? { zone: [e.bottom, e.top], obStart: e.startTime } : { price: e.price, pivotTime: e.pivotTime }) }));

  const stats = list => {
    const w = list.filter(t => t.outcome === 'success').length, l = list.filter(t => t.outcome === 'loss').length;
    return { n: w + l, win: w, loss: l, winrate: w + l ? +(w / (w + l) * 100).toFixed(1) : null, sumR: 2 * w - l, smallN: w + l < 50 };
  };
  const table = (anchor, pick, multi = false) => {
    const groups = new Map();
    for (const r of rows) for (const key of multi ? pick(r[anchor]) : [pick(r[anchor])]) {
      for (const route of ['gesamt', r.route]) {
        const g = groups.get(key) ?? { gesamt: [], a: [], b: [] }; g[route].push(r); groups.set(key, g);
      }
    }
    return Object.fromEntries([...groups].sort(([a], [b]) => a.localeCompare(b)).map(([k, g]) => [k, Object.fromEntries(Object.entries(g).map(([r, l]) => [r, stats(l)]))]));
  };
  const tables = anchor => ({
    category: table(anchor, f => f.category), kinds: table(anchor, f => f.kinds.length ? f.kinds : ['keine'], true),
    deltaT: table(anchor, f => f.deltaT), lsAge: table(anchor, f => f.lsAge), proximity: table(anchor, f => f.proximity),
  });

  const berlin = (day, hhmm) => { const utc = Date.parse(`${day}T${hhmm}:00Z`) / 1000; return utc - berlinOffsetMinutes(utc * 1000) * 60; };
  const samples = SAMPLES.map(([trade, day, at, direction, confirmed]) => {
    const target = berlin(day, at), hit = rows.filter(r => r.direction === direction).reduce((b, r) => !b || Math.abs(r.entryTime - target) < Math.abs(b.entryTime - target) ? r : b, null);
    const off = hit ? Math.round((hit.entryTime - target) / 60) : null;
    return { trade, philip: { entry: `${day} ${at}`, source: confirmed }, v0: hit && Math.abs(off) <= 30 ? { entryTime: hit.entryTime, offsetMin: off, route: hit.route, outcome: hit.outcome,
      ob1: hit.ob1, ob2: hit.ob2, byOb1: slim(hit.byOb1), byOb2: slim(hit.byOb2), sourcesBeforeOb2: sourceList(hit.byOb2) } : null };
  });

  const gitHash = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim()
    + (execSync('git status --porcelain -- . ":!analysis/dob-setup"', { cwd: root }).toString().trim() ? '-dirty' : '');
  const report = { measurement: 'dob-quelle-der-kraft-v1', git: gitHash, baseGit: base.git, symbol: SYMBOL, dataEnd: base.dataEnd,
    breakEvenWinrate: 33.3, base: stats(rows), baseByRoute: { a: stats(rows.filter(r => r.route === 'a')), b: stats(rows.filter(r => r.route === 'b')) },
    methodology: [
      'Trades: einmalige v0-Trades (Richtung/Entry/SL) aus winrate-xau-2026-dob-setup-v0.json; Anker OB1 = spätester OB1-Start aller DOB-Paare des Trades.',
      'Quelle: nur in Trade-Richtung (Short: bärischer HTF-OB / Sweep eines Hochs; Long umgekehrt), Ereignis vor dem Anker und ab der letzten XAU-Tagespause davor (dobLiveWindowStart).',
      'OB-Touch: H1/H4-OBs aus htfObCandles + detectOrderBlocks (Kante 081d2d47), erste M5-Kerze ab Erkennung, die die Zone berührt (nur der Erst-Touch).',
      'LS-Sweep: detectLiquidityLevels (Periode 5) auf H1/H4/M5, erster Touch nach Bestätigung, HTF-Zeit auf die erste M5-Kerze am Level verfeinert.',
      'Δt und Abstand: jüngste Quelle vor dem Anker; LS-Alter: jüngster Sweep (bei mehreren Levels in derselben Kerze das älteste Pivot), Sweep-Zeit − Pivot-Zeit; Nähe: Preislücke OB1 ↔ Quell-Zone/Level.',
      'n = Win + Loss (ambiguous/unknown nicht gezählt); Winrate in %; ΣR = 2·Win − Loss; smallN = n < 50. Break-even bei 2R: 33,3 %.',
      'byOb1 = Auftrag (Quelle vor OB1); byOb2 = Gegenprobe mit Anker OB2-Start, weil Philips Ereignis teils zwischen OB1 und OB2 liegt.'],
    events: Object.fromEntries(['ob H1', 'ob H4', 'ls H1', 'ls H4', 'ls M5'].map(k => [k, events.filter(e => `${e.kind} ${e.tf}` === k).length])),
    byOb1: tables('byOb1'), byOb2: tables('byOb2'), samples };
  await fs.writeFile(path.join(root, 'analysis', 'dob-setup', 'source-measurement-xau-2026.json'), JSON.stringify(report, null, 2));

  // DOB-QUELLE-KOMBI: Kombinationen der stärksten Einzelmerkmale, Anker OB1. Zone = jede Quelle des Tages, nicht nur die jüngste.
  const zones = new Map([...trades.values()].map(t => [t.ob1, m5Zones.get(t.ob1)]));
  const flags = r => {
    const f = r.byOb1, ob1 = zones.get(r.ob1), obs = f.found.filter(e => e.kind === 'ob'), lss = f.found.filter(e => e.kind === 'ls');
    const inside = (lo, hi) => ob1 && lo <= ob1.top && hi >= ob1.bottom;
    const lastOb = obs.at(-1);
    return { A: obs.length > 0, obZone: obs.some(e => inside(e.bottom, e.top)), lsLevel: lss.some(e => inside(e.price, e.price)), ls: lss.length > 0,
      obDelta1h: lastOb ? r.ob1 - lastOb.time < HOUR : false, anyDelta1h: f.deltaT === '0–1 h', latestInZone: f.proximity === 'in Zone',
      latestObInZone: Boolean(lastOb && inside(lastOb.bottom, lastOb.top)) };
  };
  const FILTERS = {
    'A: HTF-OB berührt': x => x.A,
    'B: A + OB1 in der OB-Zone': x => x.A && x.obZone,
    'C: A + Δt OB-Touch → OB1 < 1 h': x => x.A && x.obDelta1h,
    "C': A + Δt jüngste Quelle → OB1 < 1 h": x => x.A && x.anyDelta1h,
    'D: A + LS-Sweep': x => x.A && x.ls,
    'E1: OB1 in einer OB-Zone': x => x.obZone,
    'E2: OB1 an einem LS-Level': x => x.lsLevel,
    'E3: nur OB-Zone': x => x.obZone && !x.lsLevel,
    'E4: nur LS-Level': x => x.lsLevel && !x.obZone,
    'E5: OB-Zone und LS-Level': x => x.obZone && x.lsLevel,
    // Gegenstück zur Erstmessung: dort zählte nur die jüngste Quelle.
    'F1: jüngste Quelle in Zone': x => x.latestInZone,
    'F2: A + jüngste Quelle in Zone': x => x.A && x.latestInZone,
  };
  const month = r => berlinDateStrFor(r.entryTime).slice(0, 7);
  const months = [...new Set(rows.map(month))].sort();
  const sampleRows = samples.filter(s => s.v0).map(s => [s.trade, rows.find(r => r.entryTime === s.v0.entryTime && r.direction === SAMPLES.find(x => x[0] === s.trade)[3])]);
  // Overfitting-Check: Vorsprung muss in beiden Halbjahren halten.
  const HALVES = { 'Jan–Jun': m => m <= '2026-06', 'Jul–Nov': m => m >= '2026-07' };
  const summarize = kept => {
    const byMonth = Object.fromEntries(months.map(m => [m, stats(kept.filter(r => month(r) === m))]));
    return { ...stats(kept), share: +(kept.length / rows.length * 100).toFixed(1), a: stats(kept.filter(r => r.route === 'a')), b: stats(kept.filter(r => r.route === 'b')),
      monthsAboveBreakEven: Object.values(byMonth).filter(s => s.winrate != null && s.winrate > 33.3).length,
      halves: Object.fromEntries(Object.entries(HALVES).map(([h, inHalf]) => [h, stats(kept.filter(r => inHalf(month(r))))])), months: byMonth };
  };
  const evaluateFilters = (filters, flagsOf) => {
    const flagged = rows.map(r => ({ r, x: flagsOf(r) }));
    return Object.fromEntries(Object.entries(filters).map(([name, keep]) => [name, { ...summarize(flagged.filter(({ x }) => keep(x)).map(({ r }) => r)),
      samples: sampleRows.map(([trade, r]) => ({ trade, kept: Boolean(r && keep(flagsOf(r))) })) }]));
  };
  const combos = evaluateFilters(FILTERS, flags);
  const baseSummary = { ...summarize(rows), months: months.length };
  const comboReport = { measurement: 'dob-quelle-kombi-v1', git: gitHash, base: baseSummary,
    methodology: ['Basis und Quellen wie source-measurement-xau-2026.json (Anker OB1, selber Handelstag, Trade-Richtung).',
      'A = mindestens ein H1/H4-OB-Erst-Touch; B = OB1 überlappt eine dieser OB-Zonen; C = jüngster OB-Touch < 1 h vor OB1; C’ = jüngste Quelle jeder Art < 1 h vor OB1; D = zusätzlich ein LS-Sweep.',
      'E: „in Zone“ über alle Quellen des Tages: OB-Zone = OB1 überlappt eine HTF-OB-Zone; LS-Level = Level-Preis liegt innerhalb von OB1. B ist per Definition gleich E1. F: nur die jüngste Quelle (wie proximity der Erstmessung).',
      'share = Anteil der Trades an der Basis in %; Monat = Berliner Monat des Entries; monthsAboveBreakEven = Monate mit Winrate > 33,3 %.',
      'samples: ob der Filter den v0-Trade des Mustertrades behält (#136b/#139b/#140b sind Re-Entries, #140 fällt auf den Trade von #140b).'],
    filters: combos };
  await fs.writeFile(path.join(root, 'analysis', 'dob-setup', 'source-combos-xau-2026.json'), JSON.stringify(comboReport, null, 2));
  const printFilters = (title, list) => {
    console.log(`\n== ${title} (Basis ${baseSummary.winrate}% ${baseSummary.monthsAboveBreakEven}/${months.length} Monate)`);
    for (const [name, c] of Object.entries(list)) console.log(name.padEnd(44), `n=${c.n} ${c.winrate}% ${c.sumR}R ${c.share}% | a ${c.a.n} ${c.a.winrate}% | b ${c.b.n} ${c.b.winrate}%${c.b.smallN ? '*' : ''} | M ${c.monthsAboveBreakEven}/${months.length} | H1 ${c.halves['Jan–Jun'].n} ${c.halves['Jan–Jun'].winrate}% ${c.halves['Jan–Jun'].sumR}R | H2 ${c.halves['Jul–Nov'].n} ${c.halves['Jul–Nov'].winrate}% ${c.halves['Jul–Nov'].sumR}R |`, c.samples.filter(s => s.kept).map(s => s.trade).join(' '));
  };
  printFilters('Kombi', combos);

  // DOB-QUELLE-G: Abstand OB1 ↔ nächste aktive H1/H4-OB-Zone in Trade-Richtung, beliebig alt (Philip: maßgeblich ist der Preisabstand).
  // Zonen, Bruch und H1-ATR(14) aus dem gemeinsamen Modul, damit Messung und checkDobTradeSetup() nie auseinanderlaufen.
  const sourceContext = dobSourceContext({ instrument: SYMBOL,
    htfCandles: Object.fromEntries(['1h', '4h'].map(bar => [bar, htfObCandles(frames[bar], sessions, offset)])) });
  const atrAt = t => h1AtrAt(sourceContext, t);
  const G_BUCKETS = [[0, 'in Zone'], [1, '≤ 1 OB1-Höhe'], [2, '≤ 2'], [5, '≤ 5'], [Infinity, 'weiter']];
  const nearestZone = (r, tfs) => {
    const ob1 = zones.get(r.ob1), dayStart = r.byOb1.dayStart;
    if (!ob1) return null;
    const height = ob1.top - ob1.bottom;
    const source = nearestHtfSource(sourceContext, { firstOrderBlock: ob1, direction: r.direction, m5Candles: m5, timeframes: tfs });
    const best = source && { units: source.distanceUsd / height, z: { recognizedAt: source.zoneRecognizedAt } };
    if (!best) return { bucket: 'keine aktive Zone', age: null };
    const ageSec = r.ob1 - best.z.recognizedAt;
    return { bucket: G_BUCKETS.find(([max]) => best.units <= max)[1], units: best.units, usd: best.units * height,
      age: best.z.recognizedAt >= dayStart ? 'selber Tag' : ageSec <= 3 * 86400 ? '1–3 Tage' : 'älter' };
  };
  const gCache = new Map();
  const gFlags = r => {
    if (!gCache.has(r)) gCache.set(r, { ...flags(r), gH1: nearestZone(r, ['H1']), gH4: nearestZone(r, ['H4']), g: nearestZone(r, ['H1', 'H4']), atr: atrAt(r.ob1) });
    return gCache.get(r);
  };
  const bucketFilters = key => Object.fromEntries([...G_BUCKETS.map(([, b]) => b), 'keine aktive Zone']
    .map(b => [`G ${key === 'g' ? 'H1/H4' : key.slice(1)}: ${b}`, x => x[key]?.bucket === b]));
  const gTables = Object.fromEntries(['gH1', 'gH4', 'g'].map(key => [key, evaluateFilters(bucketFilters(key), gFlags)]));
  // Zonen-Alter nur zur Info: je Abstands-Bucket (H1/H4 gemeinsam) aufgeteilt.
  const gAge = Object.fromEntries(G_BUCKETS.map(([, b]) => [b, Object.fromEntries(['selber Tag', '1–3 Tage', 'älter'].map(age =>
    [age, stats(rows.filter(r => gFlags(r).g?.bucket === b && gFlags(r).g.age === age))]))]));
  const inZone = x => x.g?.bucket === 'in Zone', near1 = x => inZone(x) || x.g?.bucket === '≤ 1 OB1-Höhe';
  const le2 = x => near1(x) || x.g?.bucket === '≤ 2', le5 = x => le2(x) || x.g?.bucket === '≤ 5';
  const cPrime = x => x.A && x.anyDelta1h;
  const gCombos = evaluateFilters({
    'A': x => x.A, "C'": cPrime, 'F1': x => x.latestInZone,
    'G: in Zone (H1/H4)': inZone, 'G: in Zone oder ≤ 1 (H1/H4)': near1,
    // Buckets laufen nicht monoton (≤ 1 schwächer als ≤ 2), deshalb auch breitere Grenzen.
    'G: bis 2 OB1-Höhen (H1/H4)': le2, 'G: bis 5 OB1-Höhen (H1/H4)': le5,
    'A ∩ F1': x => x.A && x.latestInZone, "C' ∩ F1 (= A ∩ C' ∩ F1)": x => cPrime(x) && x.latestInZone,
    "G(in Zone) ∩ C'": x => inZone(x) && cPrime(x), "G(≤ 1) ∩ C'": x => near1(x) && cPrime(x),
    'G(in Zone) ∩ F1': x => inZone(x) && x.latestInZone,
    // Philip meint die Filter als ODER: ein Setup zählt, sobald einer greift. C' ⊂ A, also nur ohne A.
    'A ∪ F1': x => x.A || x.latestInZone,
    'A ∪ G(in Zone)': x => x.A || inZone(x),
    'F1 ∪ G(in Zone)': x => x.latestInZone || inZone(x),
    'A ∪ F1 ∪ G(in Zone)': x => x.A || x.latestInZone || inZone(x),
    'G(≤ 1) ∪ F1': x => near1(x) || x.latestInZone,
    "C' ∪ F1": x => cPrime(x) || x.latestInZone,
    "C' ∪ G(in Zone)": x => cPrime(x) || inZone(x),
    "C' ∪ F1 ∪ G(in Zone)": x => cPrime(x) || x.latestInZone || inZone(x),
    'G≤2 ∪ F1': x => le2(x) || x.latestInZone,
    'G≤5 ∪ F1': x => le5(x) || x.latestInZone,
    "G≤5 ∪ C'": x => le5(x) || cPrime(x),
    "G≤5 ∪ F1 ∪ C'": x => le5(x) || x.latestInZone || cPrime(x),
  }, gFlags);
  // Philip: v1 baut nur die OB-Kraftquelle. Fein-Sweep über die Grenze k (Plateau um 5 oder Zufall des groben Rasters?)
  // und ODER nur mit OB-Teilen: F1(OB) = OB1 in der Zone des jüngsten OB-Touchs, C'(OB) = jüngster OB-Touch < 1 h vor OB1 (= C).
  const SWEEP = [0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 7, 8, 10, 15];
  const within = k => x => x.g?.units != null && x.g.units <= k;
  const sweep = SWEEP.map(k => {
    const inside = evaluateFilters({ k: within(k), rest: x => x.g?.units != null && x.g.units > k }, gFlags);
    return { k, bisK: inside.k, weiterAlsK: inside.rest };
  });
  const f1Ob = x => x.latestObInZone, cOb = x => x.A && x.obDelta1h;

  // DOB-QUELLE-SWEEP: Philip will den Abstand in USD (OB-Größe schwankt). Kürzester Preisabstand OB1 ↔ Zone, 0 bei Überlappung.
  const sweepBy = (value, ks) => ks.map(k => {
    const res = evaluateFilters({ k: x => value(x) != null && value(x) <= k, rest: x => value(x) != null && value(x) > k }, gFlags);
    return { k, bisK: res.k, weiterAlsK: res.rest };
  });
  const usdOf = x => x.g?.usd ?? null;
  const atrOf = x => x.g?.usd == null || !x.atr ? null : x.g.usd / x.atr;
  const sweepUsd = sweepBy(usdOf, [0, 1, 2, 3, 5, 7, 10, 15, 20, 30]);
  const sweepAtr = sweepBy(atrOf, [0, 0.25, 0.5, 0.75, 1, 1.5, 2, 3]);
  const usdLe = k => x => usdOf(x) != null && usdOf(x) <= k;
  const usdCombos = evaluateFilters(Object.fromEntries([0, 3, 5, 7, 10, 15].flatMap(k => [
    [`G$≤${k}`, usdLe(k)], [`G$≤${k} ∪ F1`, x => usdLe(k)(x) || x.latestInZone], [`G$≤${k} ∪ C'`, x => usdLe(k)(x) || cPrime(x)],
    [`G$≤${k} ∪ F1 ∪ C'`, x => usdLe(k)(x) || x.latestInZone || cPrime(x)],
    [`G$≤${k} ∪ F1(OB) ∪ C'(OB)`, x => usdLe(k)(x) || f1Ob(x) || cOb(x)]])), gFlags);
  // Reine OB-Variante der bisher besten Kombi (F1/C' enthalten LS-Quellen als jüngste Quelle).
  const pureOb = evaluateFilters({ "C' ∪ F1 ∪ G(in Zone)": x => cPrime(x) || x.latestInZone || inZone(x),
    "C'(OB) ∪ F1(OB) ∪ G(in Zone)": x => cOb(x) || f1Ob(x) || inZone(x) }, gFlags);
  const lsShare = { "C' mit LS als jüngster Quelle": rows.filter(r => gFlags(r).A && gFlags(r).anyDelta1h && r.byOb1.latest?.kind === 'ls').length,
    'F1 mit LS als jüngster Quelle': rows.filter(r => gFlags(r).latestInZone && r.byOb1.latest?.kind === 'ls').length };
  // Session je Entry (Philip entscheidet später, v1 hat keinen Session-Filter).
  const sessionOf = r => sessions.find(s => !s.ignoreLiquidity && sessionOccurrences(s.fromMinutes, s.toMinutes, r.entryTime, r.entryTime + 1, offset, s.days).length)?.label ?? 'keine Session';
  const sessionTable = keep => {
    const groups = Map.groupBy(rows.filter(r => keep(gFlags(r))), sessionOf);
    return Object.fromEntries([...groups].map(([label, list]) => [label, { ...stats(list), halves: summarize(list).halves }]));
  };
  const obCombos = evaluateFilters(Object.fromEntries([0, 1, 2, 5].flatMap(k => [
    [`G≤${k}`, within(k)], [`G≤${k} ∪ F1(OB)`, x => within(k)(x) || f1Ob(x)], [`G≤${k} ∪ C'(OB)`, x => within(k)(x) || cOb(x)],
    [`G≤${k} ∪ F1(OB) ∪ C'(OB)`, x => within(k)(x) || f1Ob(x) || cOb(x)]])), gFlags);
  const SESSION_FILTERS = Object.fromEntries([['Basis', () => true], ['G$≤10', usdLe(10)], ['G$≤15', usdLe(15)], ['G$≤20', usdLe(20)], ['G ≤ 1,5 ATR', x => atrOf(x) != null && atrOf(x) <= 1.5],
    ["C' ∪ F1 ∪ G(in Zone)", x => cPrime(x) || x.latestInZone || inZone(x)], ['A ∪ F1', x => x.A || x.latestInZone]].map(([n, f]) => [n, sessionTable(f)]));
  const gReport = { measurement: 'dob-quelle-g-v1', git: gitHash, base: baseSummary,
    methodology: ['Basis, Anker OB1, Mustertrades wie source-combos-xau-2026.json.',
      'Aktive Zone: H1/H4-OB in Trade-Richtung (htfObCandles + detectOrderBlocks), erkannt vor OB1-Start, bis OB1-Start auf M5 nicht invalidiert (candleInvalidatesOrderBlock); Alter und frühere Touches egal.',
      'Abstand: Preislücke zwischen OB1 und der nächsten aktiven Zone in OB1-Höhen; in Zone = Überlappung. H1/H4 = nächste Zone beider Zeitebenen.',
      'Zonen-Alter (Info): Erkennung der nächsten Zone am selben Handelstag / bis 3 Tage / älter.',
      "Kombis: A/C'/F1 wie in source-combos; A ∩ C' ∩ F1 ist gleich C' ∩ F1, weil C' A enthält.",
      'halves: Jan–Jun und Jul–Nov 2026 nach Berliner Entry-Monat; Overfitting-Check = Vorsprung zur Basis in beiden Hälften.'],
    distance: gTables, zoneAgeByDistance: gAge, combos: gCombos, sweep, obCombos, sweepUsd, sweepAtr, usdCombos, pureOb, lsShare,
    sessionsByFilter: SESSION_FILTERS,
    sampleGroups: { ob: 'alle Mustertrade-Positionen außer #137 (K05)', ls: '#137 (K05)' } };
  await fs.writeFile(path.join(root, 'analysis', 'dob-setup', 'source-g-xau-2026.json'), JSON.stringify(gReport, null, 2));
  console.log('Basis Halbjahre', JSON.stringify(baseSummary.halves));
  for (const [key, t] of Object.entries(gTables)) printFilters(`G ${key}`, t);
  console.log('\n== Zonen-Alter je Abstand', JSON.stringify(gAge));
  printFilters('G-Kombis + Overfitting', gCombos);
  const half = (c, h) => `${c.halves[h].winrate}% ${c.halves[h].sumR}R`;
  console.log('\n== Sweep G bis k | weiter als k');
  for (const { k, bisK: a, weiterAlsK: b } of sweep) console.log(String(k).padStart(4), `bis: n=${a.n} ${a.winrate}% ${a.sumR}R H ${half(a, 'Jan–Jun')} / ${half(a, 'Jul–Nov')} | weiter: n=${b.n} ${b.winrate}% ${b.sumR}R H ${half(b, 'Jan–Jun')} / ${half(b, 'Jul–Nov')} | OB ${a.samples.filter(s => s.kept && s.trade !== '#137').length}/10 LS ${a.samples.find(s => s.trade === '#137').kept ? 'ja' : 'nein'}`);
  printFilters('OB-only ODER', obCombos);
  for (const [name, list] of [['USD', sweepUsd], ['ATR', sweepAtr]]) {
    console.log(`
== Sweep ${name} bis k | weiter als k`);
    for (const { k, bisK: a, weiterAlsK: b } of list) console.log(String(k).padStart(4), `bis: n=${a.n} ${a.winrate}% ${a.sumR}R H ${half(a, 'Jan–Jun')} / ${half(a, 'Jul–Nov')} | weiter: n=${b.n} ${b.winrate}% ${b.sumR}R H ${half(b, 'Jan–Jun')} / ${half(b, 'Jul–Nov')} | OB ${a.samples.filter(s => s.kept && s.trade !== '#137').length}/10 LS ${a.samples.find(s => s.trade === '#137').kept ? 'ja' : 'nein'}`);
  }
  printFilters('USD-ODER', usdCombos);
  printFilters('reine OB-Variante', pureOb);
  console.log('LS-Anteil', JSON.stringify(lsShare));
  console.log('Sessions', JSON.stringify(SESSION_FILTERS, null, 0));
  console.log(JSON.stringify({ git: gitHash, base: report.base, events: report.events }));
  for (const [name, t] of Object.entries(report.byOb1)) {
    console.log(`\n== ${name} (Anker OB1)`);
    for (const [k, g] of Object.entries(t)) console.log(k.padEnd(22), ...['gesamt', 'a', 'b'].map(r => g[r] ? `${r}: n=${g[r].n} ${g[r].winrate}% ${g[r].sumR}R${g[r].smallN ? '*' : ''}` : `${r}: –`));
  }
  console.log('\n== category (Anker OB2)');
  for (const [k, g] of Object.entries(report.byOb2.category)) console.log(k.padEnd(22), ...['gesamt', 'a', 'b'].map(r => g[r] ? `${r}: n=${g[r].n} ${g[r].winrate}% ${g[r].sumR}R${g[r].smallN ? '*' : ''}` : `${r}: –`));
  const fmt = s => new Date(s * 1000).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' });
  console.log('\n== Mustertrades');
  for (const s of samples) { if (s.v0) for (const e of s.v0.sourcesBeforeOb2) console.log('   ', s.trade, e.kind, e.tf, fmt(e.time), e.zone ?? e.price, e.pivotTime ? 'pivot ' + fmt(e.pivotTime) : 'OB ' + fmt(e.obStart)); console.log(s.trade, s.philip.source, '→', s.v0 ? `${s.v0.offsetMin}min ${s.v0.route} OB1 ${fmt(s.v0.ob1)} OB2 ${fmt(s.v0.ob2)} | OB1: ${s.v0.byOb1.kinds.join('+') || 'keine'} (${s.v0.byOb1.deltaMin ?? '–'} min, ${s.v0.byOb1.latest ? s.v0.byOb1.latest.kind + ' ' + s.v0.byOb1.latest.tf + ' ' + fmt(s.v0.byOb1.latest.time) + ' ' + (s.v0.byOb1.latest.price ?? s.v0.byOb1.latest.zone) : ''}) | OB2: ${s.v0.byOb2.kinds.join('+') || 'keine'}` : 'kein v0-Trade ±30 min'); }
} finally {
  await server.close();
}
