import {readJsonArray} from './batchJsonFiles.mjs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { createSimulationRepository } from '../src/tradeSetupSimulationRepository.js';
import {prepareSimulationPublication,openPublicationPostgres} from './simulationPublication.mjs';
import {isDeepStrictEqual} from 'node:util';
import {decodeSnapshotStructures} from '../src/tradeSetupSnapshotStorage.js';

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
const compactStructures=!process.argv.includes('--compact-structures=false');
if(run.provenance?.derivation&&!compactStructures)throw new Error('Derived publications require canonical snapshot storage');
const repository = createSimulationRepository(db);
async function rawSnapshotIds(table) {
  const ids=new Set();let offset=0;
  for(;;){
    const {data,error}=await db.from(table).select('id,structureStorage:snapshot->structureStorage->>version')
      .eq('run_id',run.id).order('id').range(offset,offset+499);
    if(error)throw error;if(!data.length)return ids;
    for(const row of data)if(!row.structureStorage)ids.add(row.id);
    offset+=data.length;
  }
}
// Auch der letzte Datensatz muss passen, bevor der erste Remote-Write erfolgt.
const rawIds={setups:await rawSnapshotIds('trade_setup_simulation_setups'),entries:await rawSnapshotIds('trade_setup_simulation_entries')};
const postgres=await openPublicationPostgres();let prepared;
try{prepared=await prepareSimulationPublication({directory,manifest,run,rawIds,compactStructures,measureJsonbSize:postgres.measure,onProgress:p=>console.log(JSON.stringify({phase:'preflight',records:p.records,maxSnapshotBytes:p.maxSnapshotBytes}))});}finally{await postgres.close();}
console.log(JSON.stringify({phase:'preflight-complete',...prepared.audit}));
await prepared.verify();
async function saveRecords(method,file) {
  let count=0,batch=[];
  async function saveBatch(batch){
    await repository[method](run.id,batch);
  }
  for await(const row of readJsonArray(path.join(prepared.directory,file))){batch.push(row);count++;if(batch.length===batchSize){await saveBatch(batch);batch=[];console.log(JSON.stringify({phase:'publish',file,count}));}}
  if(batch.length)await saveBatch(batch);
  return count;
}

await repository.saveRun(prepared.runningRun);
let entries = 0, setups = 0;
for (const instrument of manifest.instruments) {
  const candidatesFile=`${instrument}-setups.json`,entriesFile=`${instrument}-entries.json`;
  // Lange historische Strukturbelege können die Transportgrenze vor dem Zeilenlimit erreichen.
  setups+=await saveRecords('saveSetups',candidatesFile);
  entries+=await saveRecords('saveEntries',entriesFile);
  for await (const record of readJsonArray(path.join(directory,entriesFile))) {
    const stored = await repository.getSnapshot(run.id, record.snapshot.id);
    if (!isDeepStrictEqual(stored,decodeSnapshotStructures(record.snapshot))) throw new Error(`Snapshot roundtrip failed: ${record.snapshot.id}`);
  }
}
await prepared.verify();await repository.saveRun(run);
console.log(JSON.stringify({ runId: run.id, entries, setups, verified: true }));
