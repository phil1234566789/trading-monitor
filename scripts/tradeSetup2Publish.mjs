import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { createSimulationRepository } from '../src/tradeSetupSimulationRepository.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const directory = path.resolve(root, process.argv[2] ?? '.debug/trade-setup-2');
const read = file => readFile(path.join(directory, file), 'utf8').then(JSON.parse);
const run = await read('run.json');
const manifest = await read('manifest.json');
if (run.status !== 'complete') throw new Error('Only a completed local run can be published');
process.loadEnvFile(path.join(root, '.env'));
const repository = createSimulationRepository(createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }));
await repository.saveRun({ ...run, status: 'running', progress: { phase: 'publish' } });
let entries = 0, setups = 0;
for (const instrument of manifest.instruments) {
  const candidates = await read(`${instrument}-setups.json`);
  const records = await read(`${instrument}-entries.json`);
  await repository.saveSetups(run.id, candidates);
  await repository.saveEntries(run.id, records);
  for (const record of records) {
    const stored = await repository.getSnapshot(run.id, record.snapshot.id);
    // JSONB sortiert Objektschlüssel; strukturell vergleichen statt Serialisierungstext.
    const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
      ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
    if (JSON.stringify(canonical(stored)) !== JSON.stringify(canonical(record.snapshot))) throw new Error(`Snapshot roundtrip failed: ${record.snapshot.id}`);
  }
  entries += records.length; setups += candidates.length;
}
await repository.saveRun(run);
console.log(JSON.stringify({ runId: run.id, entries, setups, verified: true }));
