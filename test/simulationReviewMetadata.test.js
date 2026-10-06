import {expect,it} from 'vitest';
import {createSimulationRepository} from '../src/tradeSetupSimulationRepository.js';
import {SIMULATION_REVIEW_METADATA_FIELDS,simulationReviewMetadata} from '../src/simulationReviewMetadata.js';
import {encodeSnapshotStructures} from '../src/tradeSetupSnapshotStorage.js';

function project(snapshot){
 const row={id:snapshot.id,instrument:'GBPUSD',direction:'short',run_id:'run'};
 for(const field of SIMULATION_REVIEW_METADATA_FIELDS.split(',').filter(f=>f.includes(':'))){
  const [alias,path]=field.split(':');row[alias]=path.split('->').slice(1).reduce((value,key)=>value?.[key],snapshot)??null;
 }
 return row;
}
it('projects decisions without chart pools, trees or history for raw/v1/v2 snapshots',()=>{
 const tree={history:Array.from({length:500},(_,time)=>({time,price:1.3}))};
 const raw={id:'entry',knownAt:300,setupKey:'dr',entry:{recognizedAt:300},dealingRange:{status:'validated'},
  checklist:{status:'ready',entryModel:'legacy',setup:{primary:{recognizedAt:240,validity:{state:'active'},reactionOB:{startTime:120,top:1.35,bottom:1.34},sweep:{level:{touchedTime:180}},checks:{m5Trend:{structureState:tree}}}},
   structure:tree,checks:{m5Trend:{status:'passed',details:['D'],m1Anchor:{recognizedAt:240},structureState:tree},confluences:{rules:[],ruleVersion:'checklist-observation-rules-v3',obCandidates:[tree]}}}};
 const legacy=encodeSnapshotStructures(raw);
 const large={...raw,checklistHistory:Array.from({length:500},()=>({structureState:tree,details:['same'.repeat(400)]}))};
 const v2=encodeSnapshotStructures(large);
 expect(legacy.structureStorage.version).toBe('deduplicated-structures-v1');expect(v2.structureStorage.version).toBe('deduplicated-values-v2');
 const expected=simulationReviewMetadata(project(raw));
 for(const stored of [raw,legacy,v2])expect(simulationReviewMetadata(project(stored))).toEqual(expected);
 expect(expected.checklist.checks.m5Trend).toEqual({status:'passed',details:['D'],m1Anchor:{recognizedAt:240}});
 expect(expected.checklist.setup.primary.reactionOB).toEqual(raw.checklist.setup.primary.reactionOB);expect(expected.checklist.entryPattern).toBe('legacy');expect(expected.checklist.setup.primary.sweep.level.touchedTime).toBe(180);
 for(const omitted of ['structureStorage','structureState','checklistHistory','primary,','obCandidates'])expect(SIMULATION_REVIEW_METADATA_FIELDS).not.toContain(omitted);
});
it('continues after capped metadata pages and preserves run scoping and all294 records',async()=>{
 const datasets={trade_setup_simulation_setups:Array.from({length:271},(_,i)=>project({id:`candidate-${String(i).padStart(3,'0')}`,knownAt:i,setupKey:`dr-${i}`})),
  trade_setup_simulation_entries:Array.from({length:23},(_,i)=>project({id:`entry-${String(i).padStart(3,'0')}`,knownAt:i,entry:{recognizedAt:i}}))};
 const calls=[];const db={from:table=>{let after='';const q={select:fields=>{expect(fields).toBe(SIMULATION_REVIEW_METADATA_FIELDS);return q;},eq:(key,value)=>{expect([key,value]).toEqual(['run_id','run']);return q;},order:key=>{expect(key).toBe('id');return q;},gt:(key,value)=>{expect(key).toBe('id');after=value;return q;},
  limit:async count=>{expect(count).toBe(10);calls.push([table,after]);return {data:datasets[table].filter(r=>r.id>after).slice(0,3)};}};return q;}};
 const rows=await createSimulationRepository(db).listReviewMetadata('run');expect(rows).toHaveLength(294);expect(rows[270].id).toBe('candidate-270');expect(rows.at(-1).id).toBe('entry-022');
 expect(calls).toContainEqual(['trade_setup_simulation_setups','candidate-270']);expect(calls).toContainEqual(['trade_setup_simulation_entries','entry-022']);
});
