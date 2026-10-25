import {readJsonArray} from './batchJsonFiles.mjs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { createSimulationRepository } from '../src/tradeSetupSimulationRepository.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const directory = path.resolve(root, process.argv[2] ?? '.debug/trade-setup-2');
const batchSize = Number(process.argv.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] ?? 100);
if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) throw new Error('Batch size must be an integer from 1 to 100');
const read = file => readFile(path.join(directory, file), 'utf8').then(JSON.parse);
const run = await read('run.json');
const manifest = await read('manifest.json');
if (run.status !== 'complete') throw new Error('Only a completed local run can be published');
process.loadEnvFile(path.join(root, '.env'));
const db = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const compactStructures=process.argv.includes('--compact-structures=true');
const repository = createSimulationRepository(db, {compactStructures});
const rawRepository = createSimulationRepository(db);
async function rawSnapshotIds(table) {
  const ids=new Set();let offset=0;
  for(;;){
    const {data,error}=await db.from(table).select('id,structureStorage:snapshot->structureStorage')
      .eq('run_id',run.id).order('id').range(offset,offset+499);
    if(error)throw error;if(!data.length)return ids;
    for(const row of data)if(!row.structureStorage)ids.add(row.id);
    offset+=data.length;
  }
}
async function saveRecords(method,table,file) {
  const raw=compactStructures?await rawSnapshotIds(table):new Set();
  let count=0,batch=[];
  async function saveBatch(batch){
    const id=row=>row.snapshot?.id??row.id;
    // Ein abgebrochener Publish kann bereits rohe, unver�nderliche Zeilen enthalten.
    await rawRepository[method](run.id,batch.filter(row=>raw.has(id(row))));
    await repository[method](run.id,batch.filter(row=>!raw.has(id(row))));
  }
  for await(const row of readJsonArray(path.join(directory,file))){batch.push(row);count++;if(batch.length===batchSize){await saveBatch(batch);batch=[];}}
  if(batch.length)await saveBatch(batch);
  return count;
}

await repository.saveRun({ ...run, status: 'running', progress: { phase: 'publish' } });
let entries = 0, setups = 0;
for (const instrument of manifest.instruments) {
  const candidatesFile=`${instrument}-setups.json`,entriesFile=`${instrument}-entries.json`;
  // Lange historische Strukturbelege können die Transportgrenze vor dem Zeilenlimit erreichen.
  setups+=await saveRecords('saveSetups','trade_setup_simulation_setups',candidatesFile);
  entries+=await saveRecords('saveEntries','trade_setup_simulation_entries',entriesFile);
  for await (const record of readJsonArray(path.join(directory,entriesFile))) {
    const stored = await repository.getSnapshot(run.id, record.snapshot.id);
    // JSONB sortiert Objektschlüssel; strukturell vergleichen statt Serialisierungstext.
    const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
      ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
    if (JSON.stringify(canonical(stored)) !== JSON.stringify(canonical(record.snapshot))) throw new Error(`Snapshot roundtrip failed: ${record.snapshot.id}`);
  }
}
await repository.saveRun(run);
console.log(JSON.stringify({ runId: run.id, entries, setups, verified: true }));
