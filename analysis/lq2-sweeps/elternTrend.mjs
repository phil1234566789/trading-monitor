// LQ 2.0 Datenbasis, Schritt 1b: TS1.1-Kette (Wurzel und aktuelle Ebene) stündlich für 2026, je Instrument einmal.
// Nutzt lokale DOB-Kerzen-Caches (M5/H1/D1 wie die DOB-Läufe), keine DB. Aufruf: node elternTrend.mjs <INSTRUMENT> <cacheDir>
// Schreibt local-data/lq2-sweeps/trend-<INSTRUMENT>.json: [{at, root, current, depth}], at = volle Stunde (UTC).
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const [instrument, cacheDir, limitArg] = process.argv.slice(2);
const root = fileURLToPath(new URL('../..', import.meta.url)).replace(/[\\/]$/, '');
let envDir = root;
while (!existsSync(path.join(envDir, '.env')) && path.dirname(envDir) !== envDir) envDir = path.dirname(envDir);
const read = async f => { const c = JSON.parse(await fs.readFile(path.join(cacheDir, f), 'utf8')); return c.rows ?? c; };
const server = await createServer({ root, envDir, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const L = p => server.ssrLoadModule(p);
  const [{ prepareTradeSetup11Context }, { currentTradeSetup11Range }, { createCloseReactionCache }, { buildHistoricalDailyAnchors }] =
    await Promise.all(['/src/tradeSetup11Context.js', '/src/tradeSetup11Ownership.js', '/src/m5CloseReactionHistory.js', '/src/tradeSetup2Anchors.js'].map(L));
  const m5 = await read(`ts11/candles-${instrument}-m5.json`), d1 = await read(`ts11/candles-${instrument}-1D.json`), h1 = await read(`candles-${instrument}-1h.json`);
  // Sessions aus dem eigenen DB-Abzug (sammle.mjs): ältere Caches haben kein highLowRelevant.
  const { sessionFromRow } = await L('/src/sessionOccurrences.js');
  const sessions = JSON.parse(await fs.readFile(path.join(envDir, 'local-data', 'lq2-sweeps', 'input.json'), 'utf8')).sessions
    .filter(s => s.instrument === instrument).map(sessionFromRow);
  const anchors = buildHistoricalDailyAnchors(d1, h1), closeCache = createCloseReactionCache();
  const from = Date.parse('2026-01-05T00:00:00Z') / 1000, to = m5.at(-1).time + 300;
  const out = [], started = Date.now();
  for (let at = from; at <= to && (!limitArg || out.length < +limitArg); at += 3600) {
    const anchor = anchors.filter(a => a.knownAt <= at).sort((a, b) => b.pivotTime - a.pivotTime)[0];
    if (!anchor) { out.push({ at, root: null, current: null }); continue; }
    const ctx = prepareTradeSetup11Context({ instrument, m5Candles: m5.filter(c => c.time >= anchor.structureStartTime - 86400 && c.time < at), h1Candles: h1,
      d1Candles: d1, sessionConfigs: sessions, evaluatedAt: at });
    if (ctx.status !== 'ready') { out.push({ at, root: null, current: null, status: ctx.status }); continue; }
    const cur = currentTradeSetup11Range(ctx, closeCache);
    out.push({ at, root: ctx.chain[0]?.trend ?? null, current: cur?.trend ?? null, depth: cur?.depth ?? null });
    if (out.length % 500 === 0) console.log(instrument, out.length, Math.round((Date.now() - started) / 1000) + 's');
  }
  await fs.writeFile(path.join(envDir, 'local-data', 'lq2-sweeps', `trend-${instrument}${limitArg ? '-probe' : ''}.json`), JSON.stringify(out));
  console.log(instrument, out.length, 'Auswertungen', Math.round((Date.now() - started) / 1000) + 's');
} finally { await server.close(); }
