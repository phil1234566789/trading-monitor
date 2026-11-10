import {randomUUID} from 'node:crypto';
import {rolldown} from 'rolldown';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {encodeStatisticsIndex,decodeStatisticsIndex} from '../src/simulationStatisticsIndex.js';

let compiler;
async function projectionCompiler(){
 if(!compiler)compiler=(async()=>{
  const directory=fileURLToPath(new URL('../.debug/statistics-compiler/',import.meta.url));await mkdir(directory,{recursive:true});
  const file=path.join(directory,`projection-${process.pid}.mjs`);
  const bundle=await rolldown({input:fileURLToPath(new URL('../src/simulationStatisticsProjection.js',import.meta.url)),platform:'node'});
  try{await bundle.write({file,format:'esm'});}finally{await bundle.close();}
  return import(pathToFileURL(file).href);
 })();
 return compiler;
}

export async function buildSimulationStatistics(db,repository,runId,{onProgress=()=>{}}={}) {
 const {data:state,error}=await db.from('simulation_statistics_sources').select('revision').eq('run_id',runId).single();
 if(error)throw error;
 const snapshots=await repository.listReviewMetadata(runId,{pageSize:100}),results=await repository.listResults({runId});
 const {compileSimulationStatistics,STATISTICS_PROJECTION_VERSION}=await projectionCompiler();
 const rows=await compileSimulationStatistics(snapshots,results),generation=randomUUID();
 for(let offset=0;offset<rows.length;offset+=5){
  const {error}=await db.rpc('stage_simulation_statistics',{p_run:runId,p_generation:generation,p_revision:state.revision,p_records:rows.slice(offset,offset+5)});
  if(error)throw error;onProgress({runId,groups:Math.min(offset+5,rows.length),total:rows.length});
 }
 const {error:publishError}=await db.rpc('publish_simulation_statistics',{p_run:runId,p_generation:generation,p_revision:state.revision,p_count:rows.length,p_version:STATISTICS_PROJECTION_VERSION});
 if(publishError)throw publishError;
 const expected=new Map(JSON.parse(JSON.stringify(rows)).map(row=>[row.key,row]));let after='',verified=0;
 for(;;){let query=db.from('simulation_statistics_ranges').select('key,recognizedAt:recognized_at,summary,results,orders,detail')
   .eq('run_id',runId).eq('generation',generation).order('key').limit(25);
  if(after)query=query.gt('key',after);
  const {data,error}=await query;if(error)throw error;if(!data?.length)break;
  for(const row of data){assert.deepEqual(row,expected.get(row.key),'Statistics projection roundtrip failed: '+row.key);verified++;}
  after=data.at(-1).key;
 }
 assert.equal(verified,rows.length,'Incomplete statistics projection roundtrip');
 const index=await encodeStatisticsIndex(rows);
 const {error:indexError}=await db.rpc('save_simulation_statistics_index',{p_run:runId,p_generation:generation,p_revision:state.revision,p_index:index});
 if(indexError)throw indexError;
 const {data:stored,error:readError}=await db.from('simulation_statistics_sources').select('index_data').eq('run_id',runId).eq('generation',generation).single();
 if(readError)throw readError;
 assert.deepEqual(await decodeStatisticsIndex(stored.index_data),JSON.parse(JSON.stringify(rows.map(({key,summary,results,orders})=>({key,summary,results,orders})))),'Statistics index roundtrip failed');
 return {runId,generation,groups:rows.length,sourceSnapshots:snapshots.length};
}
