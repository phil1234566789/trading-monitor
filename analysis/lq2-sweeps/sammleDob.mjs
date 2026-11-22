// SL statt Sperre, Schritt 1: Trades der jüngsten DOB-Läufe 2026 lokal ablegen (nur lesend, paginiert).
import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { archiveClient } from '../../scripts/tradeSetup2Archive.mjs';

let envDir = fileURLToPath(new URL('../..', import.meta.url));
while (!existsSync(path.join(envDir, '.env')) && path.dirname(envDir) !== envDir) envDir = path.dirname(envDir);
process.loadEnvFile(path.join(envDir, '.env'));
const client = archiveClient({ url: process.env.VITE_SUPABASE_URL, key: process.env.VITE_SUPABASE_ANON_KEY });
export const RUNS = ['dob-lq-sweep-gbpusd-v1', 'dob-lq-sweep-eurusd-v0', 'dob-lq-sweep-v1', 'dob-setup-gbpusd-v3', 'dob-setup-eurusd-v3', 'dob-setup-v3'];
const rows = await client.pages('dob_trade_setups', { select: 'id,run_id,instrument,direction,route,entry_time,entry_price,stop_price,target_price,outcome,max_r,sl_hit,exit_time,first_ob_start,second_ob_start',
  run_id: `in.(${RUNS.join(',')})`, order: 'id.asc' });
await writeFile(path.join(envDir, 'local-data', 'lq2-sweeps', 'dob-trades.json'), JSON.stringify(rows));
console.log(rows.length, Object.entries(Object.groupBy(rows, r => r.run_id)).map(([k, v]) => `${k} ${v.length}`).join(' | '));
