// Labor DOB-LAB-ROOT-BOS (Philips Wurzel-Skizze, Long-Bild): Ein Trade gegen die Wurzel, dessen aktuelle Range gegen die Wurzel läuft,
// hat einen BOS, wenn das Extrem der aktuellen Range (HH bzw. LL) bis zum Entry das letzte LH (bzw. HL) der Wurzel vor ihrem Extrem bricht.
// Nur Messung auf den gespeicherten LQ-Sweep-v1-Trades (LS-Reaktion v7), Kontext kausal zum Entry. Schreibt analysis/dob-setup/lab-root-bos-2026.json.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createServer } from 'vite';
import { dobCandleCache } from './dobCandleCache.mjs';

const root = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
let envDir = root;
while (!existsSync(path.join(envDir, '.env')) && path.dirname(envDir) !== envDir) envDir = path.dirname(envDir);
const server = await createServer({ root, envDir, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const L = p => server.ssrLoadModule(p);
  const [{ supabase }, { fetchInitialCandles }, { fetchAllRows }, st, { dobPoiFeature, dobFeaturesOf }, { berlinDayRangeUtcMs },
    { prepareM5StructureContext }, { currentM5StructureRange }, { createCloseReactionCache }, { buildHistoricalDailyAnchors }] = await Promise.all([
    '/src/supabaseClient.js', '/src/forexCandles.js', '/src/dbReadPaging.js', '/src/dobTradeStatistics.js', '/src/dobTradeFeatures.js', '/src/berlinTime.js',
    '/src/m5StructureContext.js', '/src/m5StructureContext.js', '/src/m5CloseReactionHistory.js', '/src/tradeSetup2Anchors.js'].map(L));
  const out = { measurement: 'dob-lab-root-bos-v1', git: execSync('git rev-parse --short HEAD').toString().trim(), target: '3R', instruments: {} };
  for (const [instrument, run] of [['XAUUSD', 'dob-lq-sweep-v1'], ['GBPUSD', 'dob-lq-sweep-gbpusd-v1']]) {
    const { data: rows, error } = await fetchAllRows((from, to) => supabase.from('dob_trade_setups').select('*').eq('run_id', run)
      .order('entry_time').order('id').range(from, to));
    if (error) throw error;
    // Gleiche Kerzen wie der Lauf (LS-Reaktion-Cache ab 15.11.2025 für den D1-Anker).
    const since = berlinDayRangeUtcMs('2025-11-15').startUtcMs / 1000;
    const cacheOf = dir => dobCandleCache({ outDir: dir, symbol: instrument, refresh: false, defaultStartSec: since, startSec: since, fetchInitialCandles, supabase });
    const lsReaction = cacheOf(path.join(root, '.debug', 'dob-setup', 'ts11')), htf = cacheOf(path.join(root, '.debug', 'dob-setup'));
    const m5 = await lsReaction.candles('5m', 300, 300), h1 = await htf.candles('1h', 3600, 200), d1 = await lsReaction.candles('1D', 86400, 300);
    const sessions = await htf.sessions(), anchors = buildHistoricalDailyAnchors(d1, h1), closeCache = createCloseReactionCache();
    const featureOf = row => {
      const at = row.entry_time, anchor = anchors.filter(a => a.knownAt <= at).sort((a, b) => b.pivotTime - a.pivotTime)[0];
      if (!anchor) return { group: 'unbekannt' };
      // M5 ab Strukturstart minus 1 Tag wie lsReactionRows: mehr M5 ändert nichts, kostet nur Zeit.
      const ctx = prepareM5StructureContext({ instrument, m5Candles: m5.filter(c => c.time >= anchor.structureStartTime - 86400), h1Candles: h1,
        d1Candles: d1, sessionConfigs: sessions, evaluatedAt: at });
      if (ctx.status !== 'ready') return { group: 'unbekannt' };
      const rootState = ctx.chain[0], trade = row.direction === 'long' ? 'uptrend' : 'downtrend';
      if (rootState.trend === trade) return { group: 'mit Wurzel' };
      const current = currentM5StructureRange(ctx, closeCache);
      if (!current || current.trend !== trade) return { group: 'gegen Wurzel, Range nicht gegen Wurzel' };
      // Letztes LH vor dem Wurzel-Low (Long) bzw. letztes HL vor dem Wurzel-High (Short), aus den P5-Pivots der Wurzel.
      const extreme = trade === 'uptrend' ? rootState.currRange.low : rootState.currRange.high, type = trade === 'uptrend' ? 'high' : 'low';
      const pivot = ctx.pivotsOuter.filter(p => p.type === type && p.pivotTime < extreme.pivotTime && p.pivotTime >= anchor.structureStartTime).at(-1);
      if (!pivot) return { group: 'gegen Wurzel ohne BOS', bosLevel: null };
      const broken = trade === 'uptrend' ? current.high.price > pivot.price : current.low.price < pivot.price;
      return { group: broken ? 'gegen Wurzel mit BOS' : 'gegen Wurzel ohne BOS', bosLevel: pivot.price, rangeExtreme: (trade === 'uptrend' ? current.high : current.low).price };
    };
    const tagged = rows.map(r => ({ ...r, bos: featureOf(r) }));
    const stats = list => { const s = st.dobTotalStats(list, 3), n = s.success + s.loss;
      return { trades: list.length, win: s.success, loss: s.loss, winrate: n ? +(100 * s.success / n).toFixed(1) : null, sumR: s.sumR, avgR: n ? +(s.sumR / n).toFixed(2) : null }; };
    const groups = ['mit Wurzel', 'gegen Wurzel mit BOS', 'gegen Wurzel ohne BOS', 'gegen Wurzel, Range nicht gegen Wurzel', 'unbekannt'];
    out.instruments[instrument] = Object.fromEntries([['Kante', ['edge']], ['Kante + Überlappung', ['edge', 'overlap']], ['alle', ['edge', 'overlap', 'adjacent']]].map(([level, set]) => {
      const list = tagged.filter(r => set.includes(dobPoiFeature(dobFeaturesOf(r), 'match')));
      return [level, { gesamt: stats(list), ...Object.fromEntries(groups.map(g => [g, stats(list.filter(r => r.bos.group === g))])),
        'BOS-Pflicht (ohne BOS raus)': stats(list.filter(r => r.bos.group !== 'gegen Wurzel ohne BOS')) }];
    }));
    console.log(instrument, JSON.stringify(out.instruments[instrument], null, 1));
    if (process.env.DUMP) await fs.writeFile(`${process.env.DUMP}-${instrument}.json`, JSON.stringify(tagged.map(r => ({ id: r.id, direction: r.direction, entry_time: r.entry_time,
      entry_price: r.entry_price, stop_price: r.stop_price, max_r: r.max_r, sl_hit: r.sl_hit, outcome: r.outcome, features: r.features, bos: r.bos }))));
  }
  await fs.writeFile(path.join(root, 'analysis', 'dob-setup', 'lab-root-bos-2026.json'), JSON.stringify(out, null, 2));
} finally {
  await server.close();
}
