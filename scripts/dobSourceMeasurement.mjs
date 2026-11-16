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
  const [{ fetchInitialCandles }, { supabase }, { markIgnoredCandles, htfObCandles }, { berlinDayRangeUtcMs, berlinOffsetMinutes, berlinDateStrFor },
    { detectOrderBlocks, candleTouchesOrderBlock }, { detectLiquidityLevels, liquidityTouch, LIQUIDITY_FRACTAL_PERIOD },
    { orderBlockRecognitionTimes }, { obMinimum }, { dobLiveWindowStart }] = await Promise.all(['/src/forexCandles.js',
    '/src/supabaseClient.js', '/src/sessionOccurrences.js', '/src/berlinTime.js', '/src/orderBlockDetection.js', '/src/liquidityDetection.js',
    '/src/orderBlockRecognitionTime.js', '/src/instrumentConfig.js', '/src/dobTradeSetup.js'].map(load));
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
      category: hasOb && hasLs ? 'LS + OB' : hasOb ? 'nur OB' : hasLs ? 'nur LS' : 'keine', kinds: [...kinds].sort(),
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
      obDelta1h: lastOb ? r.ob1 - lastOb.time < HOUR : false, anyDelta1h: f.deltaT === '0–1 h', latestInZone: f.proximity === 'in Zone' };
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
  const flagged = rows.map(r => ({ r, x: flags(r) }));
  const combos = Object.fromEntries(Object.entries(FILTERS).map(([name, keep]) => {
    const kept = flagged.filter(({ x }) => keep(x)).map(({ r }) => r);
    const byMonth = Object.fromEntries(months.map(m => [m, stats(kept.filter(r => month(r) === m))]));
    return [name, { ...stats(kept), share: +(kept.length / rows.length * 100).toFixed(1), a: stats(kept.filter(r => r.route === 'a')), b: stats(kept.filter(r => r.route === 'b')),
      monthsAboveBreakEven: Object.values(byMonth).filter(s => s.winrate != null && s.winrate > 33.3).length, months: byMonth,
      samples: samples.filter(s => s.v0).map(s => { const r = rows.find(row => row.entryTime === s.v0.entryTime && row.direction === (s.v0.byOb1 && SAMPLES.find(x => x[0] === s.trade)[3]));
        return { trade: s.trade, kept: Boolean(r && keep(flags(r))) }; }) }];
  }));
  const comboReport = { measurement: 'dob-quelle-kombi-v1', git: gitHash, base: { ...report.base, monthsAboveBreakEven: months.filter(m => (stats(rows.filter(r => month(r) === m)).winrate ?? 0) > 33.3).length, months: months.length },
    methodology: ['Basis und Quellen wie source-measurement-xau-2026.json (Anker OB1, selber Handelstag, Trade-Richtung).',
      'A = mindestens ein H1/H4-OB-Erst-Touch; B = OB1 überlappt eine dieser OB-Zonen; C = jüngster OB-Touch < 1 h vor OB1; C’ = jüngste Quelle jeder Art < 1 h vor OB1; D = zusätzlich ein LS-Sweep.',
      'E: „in Zone“ über alle Quellen des Tages: OB-Zone = OB1 überlappt eine HTF-OB-Zone; LS-Level = Level-Preis liegt innerhalb von OB1. B ist per Definition gleich E1. F: nur die jüngste Quelle (wie proximity der Erstmessung).',
      'share = Anteil der Trades an der Basis in %; Monat = Berliner Monat des Entries; monthsAboveBreakEven = Monate mit Winrate > 33,3 %.',
      'samples: ob der Filter den v0-Trade des Mustertrades behält (#136b/#139b/#140b sind Re-Entries, #140 fällt auf den Trade von #140b).'],
    filters: combos };
  await fs.writeFile(path.join(root, 'analysis', 'dob-setup', 'source-combos-xau-2026.json'), JSON.stringify(comboReport, null, 2));
  console.log('\n== Kombi (Basis', JSON.stringify(comboReport.base.winrate), comboReport.base.monthsAboveBreakEven + '/' + months.length, 'Monate)');
  for (const [name, c] of Object.entries(combos)) console.log(name.padEnd(40), `n=${c.n} ${c.winrate}% ${c.sumR}R ${c.share}% | a ${c.a.n} ${c.a.winrate}% ${c.a.sumR}R | b ${c.b.n} ${c.b.winrate}% ${c.b.sumR}R${c.b.smallN ? '*' : ''} | Monate ${c.monthsAboveBreakEven}/${months.length} |`, c.samples.filter(s => s.kept).map(s => s.trade).join(' '));
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
