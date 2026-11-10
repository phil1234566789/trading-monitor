import {createClient} from '@supabase/supabase-js';
import {createSimulationRepository} from '../src/tradeSetupSimulationRepository.js';
import {buildSimulationStatistics} from './simulationStatisticsBuild.mjs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
process.loadEnvFile(process.env.STATISTICS_ENV_FILE??path.join(root,'.env'));
const db=createClient(process.env.VITE_SUPABASE_URL,process.env.VITE_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const repository=createSimulationRepository(db),selected=process.argv.slice(2);
if(!selected.length)throw new Error('Specify run IDs or --all');
const runs=await repository.listRunOptions();
for(const run of runs.filter(run=>run.status==='complete'&&(selected.includes('--all')||selected.includes(run.id)))){
 console.log(JSON.stringify(await buildSimulationStatistics(db,repository,run.id,{onProgress:p=>console.log(JSON.stringify(p))})));
}
