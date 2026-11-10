import {it,expect,vi} from 'vitest';
import {createStatisticsRepository} from '../src/simulationStatisticsRepository.js';
import {encodeStatisticsIndex} from '../src/simulationStatisticsIndex.js';

it('reads the complete statistics index separately from capped 25-DR pages and one detail',async()=>{
 const rows=Array.from({length:31},(_,i)=>({key:`k${i}`,summary:{key:`k${i}`,recognizedAt:100-i,snapshot:{runId:'run'},entries:[],features:[]},results:[],orders:[]}));
 const state={revision:1,generation:'g',version:1,group_count:31,index_data:await encodeStatisticsIndex(rows)};
 const db={from:vi.fn(table=>{let key;const q={select:()=>q,eq:(field,value)=>{if(field==='key')key=value;return q;},maybeSingle:async()=>({data:table==='simulation_statistics_sources'?state:{detail:{key,original:true}}})};return q;}),
  rpc:vi.fn((name,args)=>({limit:async()=>({data:args.p_keys.slice(0,10).map(key=>rows.find(row=>row.key===key))})}))};
 const repo=createStatisticsRepository(db),index=await repo.listStatistics('run');
 expect(index.groups).toHaveLength(31);expect(db.rpc).not.toHaveBeenCalled();
 const page=await repo.getStatisticsPage('run','g',rows.slice(0,25).map(row=>row.key));
 expect(page.map(g=>g.key)).toEqual(rows.slice(0,25).map(row=>row.key));expect(db.rpc).toHaveBeenCalledTimes(3);
 expect(await repo.getStatisticsDetail('run','g','k0')).toEqual({key:'k0',original:true});
 expect(db.from.mock.calls.every(([table])=>['simulation_statistics_sources','simulation_statistics_ranges'].includes(table))).toBe(true);
});

it('rejects source changes during loading and missing projection data rather than silently loading all snapshots',async()=>{
 const encoded=await encodeStatisticsIndex([]);let reads=0;
 const db={from:()=>{const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{revision:++reads,generation:'g',version:1,group_count:0,index_data:encoded}})};return q;}};
 await expect(createStatisticsRepository(db).listStatistics('run')).rejects.toThrow('Quelldaten');
 const missing={from:()=>{const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:null})};return q;}};
 await expect(createStatisticsRepository(missing).listStatistics('run')).rejects.toThrow('vorbereitet');
});
