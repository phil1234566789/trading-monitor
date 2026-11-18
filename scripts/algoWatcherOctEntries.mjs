// Sichtung, keine Regel: die Stufe-3-Alarme (Entries) des alten Algo-Watchers (TS2, setup2_alarm_events) vom 07.–30.10.2026.
// Ausgang je SL-Variante (weit/eng, wie im Alarm) aus FXCM-M1 bis Berliner Tagesende: Win/Loss bei 2R und 3R, maxR (0,5er-Stufen,
// dobMaxR) bis SL oder Tagesende. Chart-Link wie liveEntryLink, Replay = spätester Ausgang (sonst Tagesende) + 4 h.
// Aufruf: node scripts/algoWatcherOctEntries.mjs → analysis/algo-watcher/oct-entries-2026.json
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { dobCandleCache } from './dobCandleCache.mjs';

const SITE = 'https://phil1234566789.github.io/trading-monitor/';
const AFTER_EXIT = 4 * 3600, TARGETS = [2, 3];
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
let envDir = root;
while (!existsSync(path.join(envDir, '.env')) && path.dirname(envDir) !== envDir) envDir = path.dirname(envDir);

const server = await createServer({ root, envDir, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const load = p => server.ssrLoadModule(p);
  const [{ supabase }, { fetchInitialCandles }, { evaluateDoubleOrderBlockOutcome }, { dobMaxR }, { berlinDayRangeUtcMs, berlinDateStrFor, formatDatedTime }]
    = await Promise.all(['/src/supabaseClient.js', '/src/forexCandles.js', '/src/doubleOrderBlockOutcome.js', '/src/dobMaxR.js', '/src/berlinTime.js'].map(load));
  const { data: events, error } = await supabase.from('setup2_alarm_events').select('id,signal_at,instrument,direction,payload')
    .eq('stage', 3).eq('kind', 'trading').gte('signal_at', '2026-10-01').lt('signal_at', '2026-11-01').order('signal_at').limit(500);
  if (error) throw error;

  const start = berlinDayRangeUtcMs('2026-01-01').startUtcMs / 1000, m1 = {};
  for (const symbol of new Set(events.map(e => e.instrument)))
    m1[symbol] = await dobCandleCache({ outDir: path.join(root, '.debug', 'dob-setup'), symbol, refresh: false, defaultStartSec: start, startSec: start,
      fetchInitialCandles, supabase }).candles('1m', 60, 1500);

  const entries = events.map(event => {
    const candles = m1[event.instrument], entry = event.payload.entry;
    const variants = Object.fromEntries((event.payload.variants ?? []).filter(v => v.status === 'ready').map(v => {
      const dayEnd = berlinDayRangeUtcMs(berlinDateStrFor(v.entryTime)).endUtcMs / 1000;
      const trade = { direction: event.direction, entryTime: v.entryTime, entryPrice: v.entryPrice, stopPrice: v.stopPrice };
      const out = Object.fromEntries(TARGETS.map(k => [`${k}R`, evaluateDoubleOrderBlockOutcome({ ...trade, candles, evaluatedAt: dayEnd, instrument: event.instrument, rMultiple: k })]));
      const { maxR, slHit } = dobMaxR(trade, { candles, dataEnd: dayEnd, instrument: event.instrument });
      const exit = Math.max(...Object.values(out).map(o => o.recognizedAt ?? dayEnd));
      return [v.variant, { stop: v.stopPrice, riskPips: +(Math.abs(v.entryPrice - v.stopPrice) * 1e4).toFixed(1), maxR, slHit, exitOrDayEnd: exit,
        ...Object.fromEntries(Object.entries(out).map(([k, o]) => [k, o.status])) }];
    }));
    const replay = Math.max(...Object.values(variants).map(v => v.exitOrDayEnd)) + AFTER_EXIT;
    const query = new URLSearchParams({ setup2: entry.id, run: `live-watcher:${berlinDateStrFor(entry.recognizedAt).slice(0, 7)}`, variant: 'both',
      instrument: event.instrument, replay: String(replay), bar: '5m' });
    return { id: event.id, instrument: event.instrument, direction: event.direction, entryTime: formatDatedTime(entry.recognizedAt),
      entryPrice: event.payload.entryPrice, category: event.payload.entryCategory ?? null, variants, chart: `${SITE}#/?${query}` };
  });

  // Derselbe Entry kam teils mehrfach (z. B. als risky und full): gleiche Richtung, Entry-Zeit, Entry und weiter SL zählen einmal.
  const seen = new Set();
  for (const e of entries) { const key = `${e.instrument}:${e.direction}:${e.entryTime}:${e.entryPrice}:${e.variants.wide?.stop}`; e.duplicate = seen.has(key); seen.add(key); }
  // Bilanz je Instrument, Variante und Ziel: Winrate = Win / (Win + Loss), ΣR = k·Win − Loss; offen/unklar zählen nicht.
  const balance = {};
  for (const scope of ['alle Alarme', 'einmalig']) for (const instrument of ['EURUSD', 'GBPUSD', 'alle']) for (const variant of ['wide', 'narrow']) for (const k of TARGETS) {
    const list = entries.filter(e => (scope === 'alle Alarme' || !e.duplicate) && (instrument === 'alle' || e.instrument === instrument) && e.variants[variant])
      .map(e => e.variants[variant][`${k}R`]);
    const win = list.filter(s => s === 'success').length, loss = list.filter(s => s === 'loss').length;
    ((balance[scope] ??= {})[instrument] ??= {})[`${variant} ${k}R`] = { n: list.length, win, loss, other: list.length - win - loss,
      winrate: win + loss ? +(win / (win + loss) * 100).toFixed(1) : null, sumR: k * win - loss };
  }
  const report = { measurement: 'algo-watcher-oct-entries-v1', source: 'setup2_alarm_events stage 3 trading, 07.–30.10.2026',
    methodology: ['Ausgang je SL-Variante aus FXCM-M1 bis Berliner Tagesende (evaluateDoubleOrderBlockOutcome); was bis dahin weder TP noch SL traf, ist offen.',
      'maxR in 0,5er-Stufen (dobMaxR) bis SL oder Tagesende, höchste Stufe 5 (= ≥ 5R).', 'duplicate: gleicher Entry wurde schon als früherer Alarm gemeldet.', 'Chart: Live-Watcher-Link, Replay = spätester Ausgang (sonst Tagesende) + 4 h.'],
    balance, entries };
  const file = path.join(root, 'analysis', 'algo-watcher', 'oct-entries-2026.json');
  await fs.writeFile(file, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(balance, null, 1));
  console.log(`${entries.length} Entries → ${path.relative(root, file)}`);
} finally {
  await server.close();
}
