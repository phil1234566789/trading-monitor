// LQ-2.1-Prüfung: Bestünde der LS jedes LQ-Sweep-Trades 2026 die Regel aus src/liquidity2.js (liquidity2-v2)? WR behalten
// gegen aussortiert je Asset und Halbjahr, verlorene Winner, dazu 20 Grenzfälle zum Handprüfen. Urteil aus dem Produktivcode,
// Kennzahlen verworfener LS aus merkmale.mjs (gleiche Messung laut Kommentar in liquidity2.js). Nur lokale Daten.
// Aufruf über Vite-SSR, weil liquidity2.js die Chartobjekt-Registry mitlädt.
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
  const [{ detectStrongLiquidityLevels, LIQUIDITY2_MIN_IMPULSE_ATR }, { markIgnoredCandles, sessionFromRow }, { berlinOffsetMinutes, formatDatedTime }, M] =
    await Promise.all(['/src/liquidity2.js', '/src/sessionOccurrences.js', '/src/berlinTime.js', '/analysis/lq2-sweeps/merkmale.mjs'].map(L));
  const data = path.join(envDir, 'local-data', 'lq2-sweeps');
  const read = async f => JSON.parse(await fs.readFile(f, 'utf8'));
  const input = await read(path.join(data, 'input.json')), trades = await read(path.join(data, 'dob-trades.json'));
  const tz = s => berlinOffsetMinutes(s * 1000);
  const B = t => { const s = formatDatedTime(t); return `${s.slice(8, 10)}.${s.slice(5, 7)}. ${s.slice(11)}`; };
  const minutes = t => ((t / 60 + tz(t)) % 1440 + 1440) % 1440;
  const session = t => { const m = minutes(t); return m < 420 ? 'Asia' : m < 630 ? 'London' : m < 780 ? 'MMM' : m < 840 ? '13–14 Uhr' : m < 1320 ? 'NY' : '22–24 Uhr'; };
  const poiOf = new Map(input.runs.map(r => [r.id, r.poiTradeSetupId])), setupOf = new Map(input.setups.map(s => [s.id, s]));
  const pct = (a, b) => b ? +(100 * a / b).toFixed(1) : null;

  const rows = [], skipped = { htf: 0, ohnePoi: 0, lsNicht5m: 0, ohneLq1: 0, nachDatenende: 0 };
  for (const instrument of input.instruments) {
    const raw = await read(path.join(data, 'candles', `${instrument}-5m-${input.from}-${input.to}.json`));
    const marked = markIgnoredCandles(raw, input.sessions.filter(s => s.instrument === instrument).map(sessionFromRow), tz);
    const strong = new Map(detectStrongLiquidityLevels(marked, { instrument }).map(l => [M.key(l.dir, l.pivotTime), l]));
    const feats = M.featuresFor(instrument).features;
    for (const tr of trades.filter(t => t.instrument === instrument && ['success', 'loss'].includes(t.outcome))) {
      if (!tr.run_id.includes('lq-sweep')) { skipped.htf++; continue; }
      if (tr.entry_time >= input.to) { skipped.nachDatenende++; continue; }
      const ts = setupOf.get(poiOf.get(tr.id));
      if (!ts) { skipped.ohnePoi++; continue; }
      if (ts.ls_price == null || (ts.ls_timeframe != null && ts.ls_timeframe !== '5M')) { skipped.lsNicht5m++; continue; }
      const dir = ts.direction === 'short' ? 1 : -1, k = M.key(dir, ts.lsPivotTime), f = feats.get(k), s = strong.get(k);
      if (!f) { skipped.ohneLq1++; continue; }
      rows.push({ run: tr.run_id, instrument, richtung: tr.direction, entry: B(tr.entry_time), entryTime: tr.entry_time,
        half: +formatDatedTime(tr.entry_time).slice(5, 7) <= 6 ? 'H1' : 'H2', win: tr.outcome === 'success',
        R: tr.outcome === 'success' ? Math.abs(tr.target_price - tr.entry_price) / Math.abs(tr.entry_price - tr.stop_price) : -1,
        ts: ts.id, ls: B(ts.lsPivotTime), lsPreis: ts.ls_price, sweep: B(f.touchedTime), sweepSession: session(f.touchedTime),
        lq21: !!s, impulsAtr: +(s?.impulseAtr ?? f.impulseAtr ?? NaN).toFixed(2), swings: s?.brokenSwings ?? f.brokenSwings, lhNachLL: f.lhAfterLL,
        grund: s ? null : [f.lhAfterLL !== true ? (f.lhAfterLL == null ? 'kein Wechselpivot' : 'kein LH nach LL') : null,
          f.impulseAtr < LIQUIDITY2_MIN_IMPULSE_ATR ? 'Impuls < 0,85' : null, f.brokenSwings < 1 ? '0 Swings' : null].filter(Boolean).join(', ') || 'Messung weicht ab' });
    }
  }

  const block = list => {
    const wr = l => pct(l.filter(r => r.win).length, l.length), kept = list.filter(r => r.lq21), drop = list.filter(r => !r.lq21);
    const winners = list.filter(r => r.win);
    return { trades: list.length, behalten: kept.length, verworfen: drop.length, wrBehalten: wr(kept), wrVerworfen: wr(drop), wrAlle: wr(list),
      verloreneWinner: winners.filter(r => !r.lq21).length, verloreneWinnerAnteil: pct(winners.filter(r => !r.lq21).length, winners.length),
      sumRBehalten: +kept.reduce((s, r) => s + r.R, 0).toFixed(1), sumRVerworfen: +drop.reduce((s, r) => s + r.R, 0).toFixed(1),
      lsEindeutig: new Set(list.map(r => r.instrument + r.ls)).size, lsBehalten: new Set(kept.map(r => r.instrument + r.ls)).size };
  };
  const out = { measurement: 'lq21-pruefung-v1', regel: 'src/liquidity2.js liquidity2-v2 (LH nach LL, Impuls ≥ 0,85 H1-ATR, ≥ 1 gebrochener Swing)', skipped,
    gruppen: {}, gruende: Object.fromEntries(Object.entries(Object.groupBy(rows.filter(r => !r.lq21), r => r.grund)).map(([k, v]) => [k, v.length])) };
  for (const [g, list] of Object.entries({ alle: rows, ...Object.groupBy(rows, r => r.instrument) }))
    out.gruppen[g] = { gesamt: block(list), H1: block(list.filter(r => r.half === 'H1')), H2: block(list.filter(r => r.half === 'H2')) };

  // Stichprobe: ein Trade je LS, Grenzfälle zuerst (Impuls 0,7–1,0 ATR oder 0/1 Swing), Sweep in NY/London bevorzugt, Assets im Wechsel.
  const perLs = [...new Map(rows.map(r => [r.instrument + r.ls, r])).values()];
  const border = r => (r.impulsAtr >= 0.7 && r.impulsAtr <= 1.0 ? 2 : 0) + (r.swings <= 1 ? 1 : 0) + (['NY', 'London'].includes(r.sweepSession) ? 1 : 0);
  const pick = verdict => {
    const pool = perLs.filter(r => r.lq21 === verdict && (verdict || r.lhNachLL === true)).sort((a, b) => border(b) - border(a) || b.entryTime - a.entryTime);
    const byAsset = Object.groupBy(pool, r => r.instrument), out = [];
    for (let i = 0; out.length < 10 && i < 50; i++) for (const a of ['GBPUSD', 'EURUSD', 'XAUUSD']) if (out.length < 10 && byAsset[a]?.[i]) out.push(byAsset[a][i]);
    return out;
  };
  out.stichprobe = [...pick(true), ...pick(false)].map(({ entryTime, R, half, ...r }) => r);
  out.verloreneWinnerBeispiele = rows.filter(r => r.win && !r.lq21).slice(-5).map(({ entryTime, ...r }) => r);
  await fs.writeFile(path.join(root, 'analysis', 'lq2-sweeps', 'lq21-pruefung.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ skipped, gruende: out.gruende }));
  for (const [g, b] of Object.entries(out.gruppen)) console.log(g.padEnd(7), ['gesamt', 'H1', 'H2'].map(h => `${h}: n ${b[h].trades} beh ${b[h].behalten} WR ${b[h].wrBehalten}/${b[h].wrVerworfen} verlW ${b[h].verloreneWinner} (${b[h].verloreneWinnerAnteil}%) ΣR ${b[h].sumRBehalten}/${b[h].sumRVerworfen}`).join(' | '), 'LS', b.gesamt.lsEindeutig, 'beh', b.gesamt.lsBehalten);
  for (const s of out.stichprobe) console.log(s.lq21 ? 'BEH' : 'VER', s.instrument, s.richtung, 'LS', s.ls, 'Sweep', s.sweep, s.sweepSession, 'Imp', s.impulsAtr, 'Sw', s.swings, s.grund ?? '', s.win ? 'Win' : 'Loss', s.run);
} finally { await server.close(); }
