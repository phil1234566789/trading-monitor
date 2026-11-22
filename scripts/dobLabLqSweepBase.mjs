// DOB-LQ-SWEEP Basis (nur Messung): LQ-Sweep-Lauf eines Instruments aus der DB (--instrument, Default XAUUSD), je Verbindungsstufe
// (gleiche Kante = Philips Regel, + Überlappung, + knapp daneben: XAU ≤ 1 USD, Forex ≤ 3 Pips) die Winrate bei festem 3R und 5R, je
// Halbjahr, Ø Trades/Woche. Ohne Sperren. Schreibt analysis/dob-setup/lab-lq-sweep-base-<xau|gbpusd|eurusd>-2026.json.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createServer } from 'vite';

const flag = name => process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined;
const INSTRUMENT = flag('--instrument') ?? 'XAUUSD', TARGETS = [3, 5];
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
let envDir = root;
while (!existsSync(path.join(envDir, '.env')) && path.dirname(envDir) !== envDir) envDir = path.dirname(envDir);

const server = await createServer({ root, envDir, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const L = p => server.ssrLoadModule(p);
  const [{ supabase }, st, { fetchAllRows }, { dobPoiFeature, dobFeaturesOf }, { dobCanonicalRunId }] = await Promise.all(['/src/supabaseClient.js', '/src/dobTradeStatistics.js',
    '/src/dbReadPaging.js', '/src/dobTradeFeatures.js', '/src/dobPoiType.js'].map(L));
  const RUN = dobCanonicalRunId(INSTRUMENT, 'lq_sweep');
  const { data: rows, error } = await fetchAllRows((from, to) => supabase.from('dob_trade_setups').select('*').eq('instrument', INSTRUMENT).eq('run_id', RUN)
    .order('entry_time').order('id').range(from, to));
  if (error) throw error;
  const match = r => dobPoiFeature(dobFeaturesOf(r), 'match');
  const pct = v => v == null ? null : +(v * 100).toFixed(1);
  const stats = list => Object.fromEntries(TARGETS.map(k => { const s = st.dobTotalStats(list, k);
    return [`${k}R`, { win: s.success, loss: s.loss, winrate: pct(s.winrate), sumR: s.sumR }]; }));
  const block = list => ({ trades: list.length, ...stats(list), ...Object.fromEntries(st.DOB_HALVES.map(h => [h, stats(list.filter(r => st.dobTradeHalf(r) === h))])),
    perWeek: +(st.dobTradesPerWeek(list).perWeek ?? 0).toFixed(1) });
  const levels = { 'gleiche Kante (Regel)': ['edge'], 'Kante oder Überlappung': ['edge', 'overlap'], 'alle (inkl. knapp daneben)': ['edge', 'overlap', 'adjacent'] };
  const out = { measurement: 'dob-lab-lq-sweep-base-v1', git: execSync('git rev-parse --short HEAD').toString().trim(), instrument: INSTRUMENT, run: RUN,
    breakEven: Object.fromEntries(TARGETS.map(k => [`${k}R`, pct(st.dobBreakEven(k))])),
    share: Object.fromEntries(['edge', 'overlap', 'adjacent'].map(m => [m, rows.filter(r => match(r) === m).length])),
    methodology: [`Lauf ${RUN} (DB): DOB, dessen OB1/OB2 mit einem LS-Reaktion-OB (Box oder rohes M5-OB) eine Kante teilt (1 Tick), überlappt oder knapp daneben liegt (XAU ≤ 1 USD, Forex ≤ 3 Pips).`,
      'Stärkste Verbindung je Trade über alle tragenden Paare; einmalige Trades (Richtung/Entry/SL). Ohne Sperren, Gegen-DOB nur als Status gespeichert.',
      'Win/Loss je festem Ziel aus max_r/sl_hit (dobTotalStats); Halbjahre nach Berliner Entry-Monat; Ø Trades je Kalenderwoche.'],
    byLevel: Object.fromEntries(Object.entries(levels).map(([name, set]) => [name, block(rows.filter(r => set.includes(match(r))))])),
    onlyLevel: Object.fromEntries(['overlap', 'adjacent'].map(m => [m, block(rows.filter(r => match(r) === m))])) };
  await fs.writeFile(path.join(root, 'analysis', 'dob-setup', `lab-lq-sweep-base-${INSTRUMENT === 'XAUUSD' ? 'xau' : INSTRUMENT.toLowerCase()}-2026.json`), JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ share: out.share, breakEven: out.breakEven }));
  for (const [name, b] of [...Object.entries(out.byLevel), ...Object.entries(out.onlyLevel).map(([k, v]) => [`nur ${k}`, v])])
    console.log(name.padEnd(32), `${b.trades} T · ${b.perWeek}/W`, TARGETS.map(k => `${k}R ${b[`${k}R`].win}/${b[`${k}R`].loss} ${b[`${k}R`].winrate}% ${b[`${k}R`].sumR}R (${st.DOB_HALVES.map(h => b[h][`${k}R`].sumR).join('/')})`).join(' | '));
} finally {
  await server.close();
}
