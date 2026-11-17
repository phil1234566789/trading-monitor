// DOB-WOCHENTAG (Philip, nur Messung): Montag Vormittag und Freitag Nachmittag/Abend gegen den Rest der Woche, je Lauf ohne und mit
// gespeicherter Konfig. Buckets nach Berliner Entry-Zeit, Grenzen 12/14 Uhr mit ±2 h gegengeprüft. „SL < 30 min“ aus dem 2R-Ausgang des
// Laufs (Loss mit Ausstieg ≤ 30 min nach Entry): der SL fiel vor 2R und früh. Urteil: Sperre lohnt, wenn die Winrate bei 3R ohne den
// Bucket in beiden Halbjahren steigt und ΣR mit Konfig höchstens 10 % fällt. Schreibt analysis/dob-setup/lab-weekday-2026.json.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
let envDir = root;
while (!existsSync(path.join(envDir, '.env')) && path.dirname(envDir) !== envDir) envDir = path.dirname(envDir);
const CARRIERS = [
  { name: 'XAU HTF-OB v3', instrument: 'XAUUSD', run: 'dob-setup-v3', poiType: 'htf_ob' },
  { name: 'XAU LQ-Sweep v0 (gleiche Kante)', instrument: 'XAUUSD', run: 'dob-lq-sweep-v0', poiType: 'lq_sweep', edgeOnly: true },
  { name: 'GBPUSD HTF-OB v3', instrument: 'GBPUSD', run: 'dob-setup-gbpusd-v3', poiType: 'htf_ob' },
];

const server = await createServer({ root, envDir, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const L = p => server.ssrLoadModule(p);
  const [{ supabase }, st, g, pp, bt, { fetchAllRows }, tf] = await Promise.all(['/src/supabaseClient.js', '/src/dobTradeStatistics.js', '/src/dobGuardrails.js',
    '/src/dobPartialProfit.js', '/src/berlinTime.js', '/src/dbReadPaging.js', '/src/dobTradeFeatures.js'].map(L));
  // Berliner Wochentag (1 = Mo … 5 = Fr) und Stunde des Entrys.
  const local = s => { const d = new Date((s + bt.berlinOffsetMinutes(s * 1000) * 60) * 1000); return { day: d.getUTCDay(), hour: d.getUTCHours() + d.getUTCMinutes() / 60 }; };
  const bucketsFor = (mon, fri) => ({ [`Mo 02–${mon}`]: t => t.day === 1 && t.hour < mon, [`Mo ab ${mon}`]: t => t.day === 1 && t.hour >= mon,
    'Di–Do': t => t.day >= 2 && t.day <= 4, [`Fr bis ${fri}`]: t => t.day === 5 && t.hour < fri, [`Fr ab ${fri}`]: t => t.day === 5 && t.hour >= fri });
  const r1 = v => Math.round(v * 10) / 10, pct = v => v == null ? null : r1(v * 100);
  const halves = list => Object.fromEntries(st.DOB_HALVES.map(h => [h, list.filter(r => st.dobTradeHalf(r) === h)]));
  const fixed = (list, k) => st.dobTotalStats(list, k);
  const early = list => { const losses = list.filter(r => r.outcome === 'loss'); const fast = losses.filter(r => r.exit_time != null && r.exit_time - r.entry_time <= 1800).length;
    return { slUnder30: fast, shareOfTrades: list.length ? pct(fast / list.length) : null, shareOfLosses: losses.length ? pct(fast / losses.length) : null }; };
  const measure = (list, cfg) => {
    const out = { trades: list.length, wr3: pct(fixed(list, 3).winrate), sum3: r1(fixed(list, 3).sumR), sum5: r1(fixed(list, 5).sumR), ...early(list) };
    for (const [h, l] of Object.entries(halves(list))) out[h] = { trades: l.length, wr3: pct(fixed(l, 3).winrate), sum3: r1(fixed(l, 3).sumR), sum5: r1(fixed(l, 5).sumR),
      ...(cfg ? { sumConfig: r1(st.dobTotalStats(l, r => pp.dobRowConfigScore(cfg, r)).sumR) } : {}) };
    if (cfg) out.sumConfig = r1(st.dobTotalStats(list, r => pp.dobRowConfigScore(cfg, r)).sumR);
    return out;
  };
  // Sperre des Buckets gegen „alle“: Winrate 3R je Halbjahr ohne den Bucket, ΣR (Konfig-TP, ohne Konfig 3R) mit und ohne.
  const verdict = (all, rest, cfg) => {
    const wrUp = st.DOB_HALVES.every(h => { const a = fixed(halves(all)[h], 3).winrate, b = fixed(halves(rest)[h], 3).winrate; return b != null && a != null && b > a; });
    const sum = l => cfg ? st.dobTotalStats(l, r => pp.dobRowConfigScore(cfg, r)).sumR : fixed(l, 3).sumR;
    // Rückgang relativ zum Betrag, damit „höchstens 10 % weniger“ auch bei negativem ΣR (GBPUSD ohne Konfig) ein Urteil gibt.
    const before = sum(all), after = sum(rest), drop = before !== 0 ? (before - after) / Math.abs(before) : null;
    return { winrate3UpBothHalves: wrUp, sumBefore: r1(before), sumAfter: r1(after), sumDropPct: drop == null ? null : pct(drop), blockWorth: wrUp && drop != null && drop <= 0.1 };
  };
  const out = { measurement: 'dob-lab-weekday-v1', git: execSync('git rev-parse --short HEAD').toString().trim(),
    methodology: ['Buckets nach Berliner Entry-Wochentag/-Stunde (Montag ab 02:00, davor kein Entry); Grenzen 12 (Mo) und 14 (Fr) mit 10/14 bzw. 12/16 gegengeprüft.',
      'Ohne Konfig: alle Trades des Laufs, feste Ziele 3R/5R. Mit Konfig: erlaubte Trades nach der gespeicherten Konfig, ΣR mit Konfig-TP (inkl. Teilprofit).',
      'LQ-Sweep: nur Trades mit gleicher Kante (Regel); Konfig-Variante mit poiMatchMode = edge.',
      'SL < 30 min: Trade mit Loss im 2R-Ausgang des Laufs und Ausstieg höchstens 30 min nach Entry.',
      'Sperre lohnt: Winrate 3R ohne den Bucket in beiden Halbjahren höher als mit, und ΣR (Konfig-TP; ohne Konfig 3R) fällt höchstens 10 %.'],
    carriers: {} };
  for (const c of CARRIERS) {
    const { data: rowsAll, error } = await fetchAllRows((from, to) => supabase.from('dob_trade_setups').select('*').eq('instrument', c.instrument).eq('run_id', c.run)
      .order('entry_time').order('id').range(from, to));
    if (error) throw error;
    const rows = c.edgeOnly ? rowsAll.filter(r => tf.dobPoiFeature(tf.dobFeaturesOf(r), 'match') === 'edge') : rowsAll;
    const { data: cfgRow, error: e2 } = await g.dobGuardrailsQuery(supabase, c.instrument, c.poiType);
    if (e2) throw e2;
    const cfg = { ...g.dobGuardrailsFromRow(cfgRow), ...(c.edgeOnly ? { poiMatchMode: 'edge' } : {}) };
    const allowed = rows.filter(r => !g.dobRowGuardrailReason(cfg, r));
    const res = { trades: rows.length, allowedByConfig: allowed.length, config: g.dobGuardrailsSummary(cfg), variants: {} };
    for (const [mon, fri] of [[12, 14], [10, 12], [14, 16]]) {
      const buckets = bucketsFor(mon, fri), key = `Mo ${mon} / Fr ${fri}`;
      const one = (list, withCfg) => ({ total: measure(list, withCfg ? cfg : null),
        buckets: Object.fromEntries(Object.entries(buckets).map(([b, f]) => { const inB = list.filter(r => f(local(r.entry_time)));
          return [b, { ...measure(inB, withCfg ? cfg : null), ifBlocked: verdict(list, list.filter(r => !f(local(r.entry_time))), withCfg ? cfg : null) }]; })) });
      res.variants[key] = { ohneKonfig: one(rows, false), mitKonfig: one(allowed, true) };
    }
    out.carriers[c.name] = res;
  }
  await fs.writeFile(path.join(root, 'analysis', 'dob-setup', 'lab-weekday-2026.json'), JSON.stringify(out, null, 2));
  for (const [name, c] of Object.entries(out.carriers)) {
    console.log(`\n== ${name}: ${c.trades} T, mit Konfig ${c.allowedByConfig}`);
    for (const [vk, v] of Object.entries(c.variants)) for (const mode of ['ohneKonfig', 'mitKonfig']) {
      console.log(` -- ${vk} · ${mode} · gesamt ${v[mode].total.trades} T WR3 ${v[mode].total.wr3}% Σ3 ${v[mode].total.sum3} Σ5 ${v[mode].total.sum5}${v[mode].total.sumConfig != null ? ` ΣK ${v[mode].total.sumConfig}` : ''}`);
      for (const [b, m] of Object.entries(v[mode].buckets)) console.log(`   ${b.padEnd(10)} ${String(m.trades).padStart(4)} T WR3 ${m.wr3}% (${st.DOB_HALVES.map(h => m[h].wr3).join('/')}) Σ3 ${m.sum3} (${st.DOB_HALVES.map(h => m[h].sum3).join('/')}) Σ5 ${m.sum5} (${st.DOB_HALVES.map(h => m[h].sum5).join('/')})${m.sumConfig != null ? ` ΣK ${m.sumConfig} (${st.DOB_HALVES.map(h => m[h].sumConfig).join('/')})` : ''} SL<30 ${m.shareOfTrades}% · Sperre: WR↑beide ${m.ifBlocked.winrate3UpBothHalves} Σ ${m.ifBlocked.sumBefore}→${m.ifBlocked.sumAfter} (${m.ifBlocked.sumDropPct}%) ${m.ifBlocked.blockWorth ? 'LOHNT' : '–'}`);
    }
  }
} finally {
  await server.close();
}
