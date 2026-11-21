// LQ 2.0 Datenbasis, Schritt 1: Positiv-/Negativ-Mengen und Kerzen holen (nur lesend). Schreibt
// local-data/lq2-sweeps/input.json und je Instrument die M5-Kerzen. Kerzen einmal je Instrument über den
// Archiv-Cache (scripts/tradeSetup2Archive.mjs); ein vorhandener älterer Cache aus dem Haupt-Checkout wird als
// .partial übernommen, damit nur das Delta aus fxcm_candles kommt.
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { archiveClient } from '../../scripts/tradeSetup2Archive.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
let envDir = root;
while (!existsSync(path.join(envDir, '.env')) && path.dirname(envDir) !== envDir) envDir = path.dirname(envDir);
process.loadEnvFile(path.join(envDir, '.env'));
const client = archiveClient({ url: process.env.VITE_SUPABASE_URL, key: process.env.VITE_SUPABASE_ANON_KEY });
const out = path.join(envDir, 'local-data', 'lq2-sweeps');
await mkdir(path.join(out, 'candles'), { recursive: true });

export const FROM = 1766617200; // 25.12.2025, gleicher Startpunkt wie der vorhandene Setup1-Cache (M5-Warmup)
export const TO = Date.parse('2026-11-21T00:00:00Z') / 1000;
const INSTRUMENTS = ['GBPUSD', 'EURUSD', 'XAUUSD'];
const sec = t => t == null ? null : Date.parse(t) / 1000;

for (const instrument of INSTRUMENTS) {
  const file = path.join(out, 'candles', `${instrument}-5m-${FROM}-${TO}.json`);
  const seed = path.join(envDir, 'local-data/setup1-builds/2026-10-04T19-37-21.794Z/candles', `${instrument}-5m-${FROM}-1791142641.json`);
  if (!existsSync(file) && !existsSync(file + '.partial') && existsSync(seed)) await copyFile(seed, file + '.partial');
  const rows = await client.candles({ instrument, bar: '5m', from: FROM, to: TO, cacheDirectory: path.join(out, 'candles'),
    onPage: n => { if (n % 20000 === 0) console.log(instrument, n); } });
  console.log(instrument, 'M5', rows.length);
}

const sessions = await client.pages('sessions', { select: '*', order: 'id.asc' });
const pins = await client.pages('pin_context', { select: 'id,note,pin_type,m5_liquidity_instrument,m5_liquidity_direction,m5_liquidity_price,m5_liquidity_pivot_time',
  kind: 'eq.m5_liquidity_level', order: 'id.asc' });
const positions = await client.pages('trade_positions', { select: 'id,outcome,r_multiple,triggered_at,dealing_range_id', order: 'id.asc' });
const ranges = await client.pages('dealing_ranges', { select: 'id,instrument,direction,trade_setup_id', order: 'id.asc' });
const evidence = await client.pages('trade_evidence', { select: 'id,dealing_range_id,trade_position_id,kind,timeframe,price,source_time',
  kind: 'eq.pivot', order: 'id.asc' });
const runs = await client.pages('dob_trade_setups', { select: 'id,run_id,instrument,direction,outcome,entry_time,max_r,features',
  run_id: 'like.dob-lq-sweep*', order: 'id.asc' });

// TS-Setups nur für die verknüpften IDs (Journal + Läufe), in kleinen in()-Blöcken statt der ganzen Tabelle.
const tsIds = [...new Set([...ranges.map(r => r.trade_setup_id), ...runs.map(r => r.features?.poi_trade_setup_id)].filter(Boolean))];
const setups = [];
for (let i = 0; i < tsIds.length; i += 150) setups.push(...await client.pages('trade_setups', {
  select: 'id,instrument,direction,ls_price,ls_pivot_time,ls_touched_time,ls_timeframe', id: `in.(${tsIds.slice(i, i + 150).join(',')})`, order: 'id.asc' }));

const input = {
  from: FROM, to: TO, snapshotAt: new Date().toISOString(), instruments: INSTRUMENTS, sessions,
  pins: pins.map(p => ({ ...p, pivotTime: sec(p.m5_liquidity_pivot_time) })),
  positions, ranges, evidence: evidence.map(e => ({ ...e, sourceTime: sec(e.source_time) })),
  runs: runs.map(({ features, ...r }) => ({ ...r, poiTradeSetupId: features?.poi_trade_setup_id ?? null })),
  setups: setups.map(s => ({ ...s, lsPivotTime: sec(s.ls_pivot_time), lsTouchedTime: sec(s.ls_touched_time) })),
};
await writeFile(path.join(out, 'input.json'), JSON.stringify(input));
console.log({ pins: pins.length, positions: positions.length, ranges: ranges.length, evidence: evidence.length, runs: runs.length, setups: setups.length });
