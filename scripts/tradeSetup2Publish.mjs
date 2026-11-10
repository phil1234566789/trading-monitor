import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { createSimulationRepository } from '../src/tradeSetupSimulationRepository.js';
import {prepareSimulationPublication,openPublicationPostgres} from './simulationPublication.mjs';
import {isDeepStrictEqual} from 'node:util';
import {readPublicationCatalog,savePublicationRecords,verifyPublicationRecords} from './simulationPublicationResume.mjs';
import {buildSimulationStatistics} from './simulationStatisticsBuild.mjs';

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
// Auch der letzte Datensatz muss passen, bevor der erste Remote-Write erfolgt.
const catalog={setups:await readPublicationCatalog(db,'setups',run.id),entries:await readPublicationCatalog(db,'entries',run.id)};
const rawIds={setups:catalog.setups.rawIds,entries:catalog.entries.rawIds};
const postgres=await openPublicationPostgres();let prepared;
try{prepared=await prepareSimulationPublication({directory,manifest,run,rawIds,compactStructures,measureJsonbSize:postgres.measure,onProgress:p=>console.log(JSON.stringify({phase:'preflight',records:p.records,maxSnapshotBytes:p.maxSnapshotBytes}))});}finally{await postgres.close();}
console.log(JSON.stringify({phase:'preflight-complete',...prepared.audit}));
await prepared.verify();
async function saveRecords(kind,file) {
  const method=kind==='setups'?'saveSetups':'saveEntries';
  const result=await savePublicationRecords({db,runId:run.id,kind,file:path.join(prepared.directory,file),
    existingIds:catalog[kind].ids,batchSize,save:batch=>repository[method](run.id,batch),
    onProgress:p=>console.log(JSON.stringify({phase:'publish',file,count:p.records,skipped:p.skipped,written:p.written}))});
  return result.records;
}

await repository.saveRun(prepared.runningRun);
let entries = 0, setups = 0;
for (const instrument of manifest.instruments) {
  const candidatesFile=`${instrument}-setups.json`,entriesFile=`${instrument}-entries.json`;
  // Lange historische Strukturbelege können die Transportgrenze vor dem Zeilenlimit erreichen.
  setups+=await saveRecords('setups',candidatesFile);
  entries+=await saveRecords('entries',entriesFile);
}
await verifyPublicationRecords({db,runId:run.id,directory:prepared.directory,instruments:manifest.instruments,
  onProgress:p=>console.log(JSON.stringify({phase:'roundtrip',...p}))});
await prepared.verify();await repository.saveRun(run);
if(!isDeepStrictEqual(await repository.getRun(run.id),run))throw new Error('Run metadata roundtrip failed');
await buildSimulationStatistics(db,repository,run.id);
console.log(JSON.stringify({ runId: run.id, entries, setups, verified: true }));
