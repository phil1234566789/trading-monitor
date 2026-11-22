// c-losses: Variante (c) M15 aus sl-statt-sperre.json zerlegen. Max-DD (Peak→Tal), Monatskurven, Loss-Merkmale mit Halbjahresprobe.
// Zielmaß Winrate (Philip: TPs per Hand, ΣR kein Argument). Nur lokale Daten; Vite-SSR für den H1-Trend (dobOuterTrend, TS-Struktur).
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
  const [{ dobOuterTrend }, { markIgnoredCandles, sessionFromRow }, { berlinOffsetMinutes, formatDatedTime }, M] = await Promise.all(
    ['/src/dobLabFeatures.js', '/src/sessionOccurrences.js', '/src/berlinTime.js', '/analysis/lq2-sweeps/merkmale.mjs'].map(L));
  const data = path.join(envDir, 'local-data', 'lq2-sweeps');
  const read = async f => JSON.parse(await fs.readFile(f, 'utf8'));
  const sss = await read(path.join(root, 'analysis', 'lq2-sweeps', 'sl-statt-sperre.json'));
  const input = await read(path.join(data, 'input.json')), news = await read(path.join(data, 'news.json'));
  const tz = s => berlinOffsetMinutes(s * 1000);
  const B = t => { const s = formatDatedTime(t); return `${s.slice(8, 10)}.${s.slice(5, 7)}. ${s.slice(11)}`; };
  const minutes = t => ((t / 60 + tz(t)) % 1440 + 1440) % 1440;
  const session = t => { const m = minutes(t); return m < 420 ? 'Asia' : m < 630 ? 'London' : m < 780 ? 'MMM' : m < 840 ? '13–14 Uhr' : m < 1320 ? 'NY' : '22–24 Uhr'; };
  const weekday = t => ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][new Date((t + tz(t) * 60) * 1000).getUTCDay()];
  const month = t => formatDatedTime(t).slice(0, 7);
  const poiOf = new Map(input.runs.map(r => [r.id, r.poiTradeSetupId])), setupOf = new Map(input.setups.map(s => [s.id, s]));
  const NEWS_CCY = { GBPUSD: ['GBP', 'USD'], EURUSD: ['EUR', 'USD'], XAUUSD: ['USD'] };
  const newsTimes = Object.fromEntries(Object.entries(NEWS_CCY).map(([i, c]) => [i, news.filter(n => c.includes(n.currency)).map(n => Date.parse(n.event_time) / 1000)]));
  const agg = (c, dur) => { const o = []; for (const x of c) { const t = Math.floor(x.time / dur) * dur, l = o.at(-1);
    if (l?.time === t) { l.high = Math.max(l.high, x.high); l.low = Math.min(l.low, x.low); l.close = x.close; } else o.push({ ...x, time: t, ignored: false }); } return o; };

  const rows = sss.alle, per = {};
  for (const instrument of input.instruments) {
    const raw = await read(path.join(data, 'candles', `${instrument}-5m-${input.from}-${input.to}.json`));
    const m5 = markIgnoredCandles(raw, input.sessions.filter(s => s.instrument === instrument).map(sessionFromRow), tz).filter(c => !c.ignored);
    per[instrument] = { h1: agg(m5, 3600), ls: M.featuresFor(instrument).features };
  }
  for (const r of rows) {
    const P = per[r.instrument], t = Math.floor(r.entryTime / 300) * 300, dir = r.side === -1 ? 'short' : 'long';
    r.family = r.run.includes('lq-sweep') ? 'LQ-Sweep' : 'HTF-OB v3';
    r.month = month(r.entryTime); r.weekday = weekday(r.entryTime); r.session = session(r.entryTime);
    r.h1Trend = dobOuterTrend(P.h1, t, dir, { windowDays: 10, barSeconds: 3600 }).verdict;
    r.newsNah = newsTimes[r.instrument].some(n => n >= r.entryTime - 3600 && n <= r.entryTime + 2 * 3600);
    // c gilt nur bei Treffern; sonst bleibt das DOB-Ergebnis.
    r.c = r.hitA || r.hitB ? r.cM15.ergebnis : r.outcome === 'success' ? 'win' : 'loss';
    r.cR = r.hitA || r.hitB ? r.cM15.R : r.ra;
    if (r.hitA || r.hitB) {
      const near = [...r.hindernisse].sort((a, b) => a.dist - b.dist)[0];
      r.hindernisTyp = r.hitA && r.hitB ? 'A+B' : r.hitA ? 'nur A (FVG)' : 'nur B (OB)';
      r.hindernisTf = [...new Set(r.hindernisse.map(h => h.tf))].sort().join('+');
      r.hoechsterTf = r.hindernisse.some(h => h.tf === '1H') ? '1H' : r.hindernisse.some(h => h.tf === '15M') ? '15M' : '5m';
      r.distAtr = near.dist < 0 ? 'Entry in Zone' : near.dist < 0.25 ? '0–0,25 ATR' : '0,25–0,5 ATR';
      r.slFaktor = r.cM15.riskFaktor < 1.5 ? '< 1,5×' : r.cM15.riskFaktor < 2.5 ? '1,5–2,5×' : r.cM15.riskFaktor < 4 ? '2,5–4×' : '≥ 4×';
    }
    const ts = setupOf.get(poiOf.get(r.id));
    const f = ts && ts.ls_price != null ? P.ls.get(M.key(ts.direction === 'short' ? 1 : -1, ts.lsPivotTime)) : null;
    r.lq21 = f ? (f.impulseAtr >= 0.85 && f.brokenSwings >= 1 && f.lhAfterLL === true ? 'LQ 2.1 erfüllt' : 'LQ 2.1 nicht erfüllt') : null;
    r.lsImpuls = f ? (f.impulseAtr >= 1.5 ? '≥ 1,5 ATR' : f.impulseAtr >= 0.85 ? '0,85–1,5 ATR' : '< 0,85 ATR') : null;
    r.lsSwings = f ? (f.brokenSwings >= 2 ? '≥ 2' : String(f.brokenSwings)) : null;
    r.lsAlter = f ? (f.ageHours >= 10 ? '≥ 10 h' : f.ageHours >= 2 ? '2–10 h' : '< 2 h') : null;
  }

  // 1. Max-DD (Peak → Tal) der Variante c je Familie, Monatskurven je Asset.
  const pct = (a, b) => b ? +(100 * a / b).toFixed(1) : null;
  const ddOf = list => {
    let cum = 0, peak = 0, peakI = -1, best = { dd: 0 };
    list.forEach((r, i) => { cum += r.cR; if (cum > peak) { peak = cum; peakI = i; } if (peak - cum > best.dd) best = { dd: peak - cum, from: peakI + 1, to: i }; });
    const win = list.slice(best.from, best.to + 1);
    return { maxDD: +best.dd.toFixed(1), von: win[0] && B(win[0].entryTime), bis: win.at(-1) && B(win.at(-1).entryTime), trades: win.length,
      wr: pct(win.filter(r => r.c === 'win').length, win.length),
      jeAsset: Object.fromEntries(Object.entries(Object.groupBy(win, r => r.instrument)).map(([k, v]) => [k, { n: v.length, R: +v.reduce((s, r) => s + r.cR, 0).toFixed(1), wr: pct(v.filter(r => r.c === 'win').length, v.length) }])),
      jeMonat: Object.fromEntries(Object.entries(Object.groupBy(win, r => r.month)).map(([k, v]) => [k, v.length])) };
  };
  const out = { measurement: 'c-losses-v1', variante: 'c M15 (Treffer: SL hinter letzten unberührten M15-P2; sonst DOB-Ergebnis)', familien: {} };
  for (const fam of ['LQ-Sweep', 'HTF-OB v3']) {
    const list = rows.filter(r => r.family === fam).sort((a, b) => a.entryTime - b.entryTime);
    const curve = Object.fromEntries(input.instruments.map(i => [i, Object.fromEntries(Object.entries(Object.groupBy(list.filter(r => r.instrument === i), r => r.month))
      .sort().map(([m, v]) => [m, { n: v.length, wrC: pct(v.filter(r => r.c === 'win').length, v.length), wrA: pct(v.filter(r => r.outcome === 'success').length, v.length),
        RC: +v.reduce((s, r) => s + r.cR, 0).toFixed(1) }]))]));
    out.familien[fam] = { maxDD: ddOf(list), jeAssetDD: Object.fromEntries(input.instruments.map(i => [i, ddOf(list.filter(r => r.instrument === i))])), monate: curve };
  }

  // 2. Loss-Merkmale: nur Treffer (dort wirkt c), WR je Ausprägung, Gesamt und je Halbjahr.
  const hits = rows.filter(r => (r.hitA || r.hitB) && r.c !== 'offen');
  const FEATURES = ['instrument', 'family', 'session', 'weekday', 'month', 'h1Trend', 'hindernisTyp', 'hoechsterTf', 'distAtr', 'slFaktor', 'lq21', 'lsImpuls', 'lsSwings', 'lsAlter', 'newsNah'];
  const base = { n: hits.length, wr: pct(hits.filter(r => r.c === 'win').length, hits.length),
    H1: pct(hits.filter(r => r.half === 'H1' && r.c === 'win').length, hits.filter(r => r.half === 'H1').length),
    H2: pct(hits.filter(r => r.half === 'H2' && r.c === 'win').length, hits.filter(r => r.half === 'H2').length) };
  const merkmale = {};
  for (const f of FEATURES) {
    merkmale[f] = Object.fromEntries(Object.entries(Object.groupBy(hits.filter(r => r[f] != null), r => String(r[f]))).sort().map(([k, v]) => {
      const h = x => v.filter(r => r.half === x), wr = l => pct(l.filter(r => r.c === 'win').length, l.length);
      const d1 = wr(h('H1')) - base.H1, d2 = wr(h('H2')) - base.H2;
      // Auffällig nur, wenn beide Halbjahre ≥ 30 Treffer haben und in dieselbe Richtung ≥ 5 Punkte abweichen.
      const auffaellig = h('H1').length >= 30 && h('H2').length >= 30 && Math.abs(d1) >= 5 && Math.abs(d2) >= 5 && Math.sign(d1) === Math.sign(d2);
      return [k, { n: v.length, wr: wr(v), nH1: h('H1').length, wrH1: wr(h('H1')), nH2: h('H2').length, wrH2: wr(h('H2')), auffaellig }];
    }));
  }
  out.treffer = base; out.merkmale = merkmale;
  out.auffaellig = Object.entries(merkmale).flatMap(([f, m]) => Object.entries(m).filter(([, v]) => v.auffaellig).map(([k, v]) => ({ merkmal: f, wert: k, ...v })));
  // 3. Typische Losses: Treffer mit c-Loss aus den auffälligen Loss-Gruppen, sonst die jüngsten.
  const lossy = out.auffaellig.filter(a => a.wr < base.wr);
  const pick = hits.filter(r => r.c === 'loss' && (lossy.length ? lossy.some(a => String(r[a.merkmal]) === a.wert) : true)).sort((a, b) => b.entryTime - a.entryTime);
  out.lossBeispiele = pick.filter((r, i, a) => a.findIndex(x => x.instrument === r.instrument && x.month === r.month) === i).slice(0, 5).map(r => ({
    run: r.run, asset: r.instrument, richtung: r.side === -1 ? 'Short' : 'Long', entry: r.entry, entryPreis: r.entryPrice, slDob: r.sl, slC: r.cM15.sl,
    swing: r.cM15.swing, slFaktor: r.cM15.riskFaktor, ziel: r.target, stopp: r.cM15.zeit, session: r.session, h1Trend: r.h1Trend, hindernis: r.hindernisse.slice(0, 2) }));
  await fs.writeFile(path.join(root, 'analysis', 'lq2-sweeps', 'c-losses.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ treffer: base, dd: Object.fromEntries(Object.entries(out.familien).map(([k, v]) => [k, v.maxDD])), auffaellig: out.auffaellig }, null, 1));
} finally { await server.close(); }
