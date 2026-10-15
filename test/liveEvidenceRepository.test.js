import {it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {createLiveEvidenceRepository} from '../src/liveEvidenceRepository.js';
import {createSetup2Repository} from '../src/setup2Repository.js';
import {packEvidence} from '../services/setup2/evidencePayload.js';
const run='live-watcher:2026-10',at=Date.parse('2026-10-13T08:23:00Z')/1000,iso=time=>new Date(time*1000).toISOString();
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function fixture(){
 const payloads=new Map(),heavy=Array.from({length:200},(_,i)=>({time:i,price:i}));
 const make=(id,knownAt=at,config='config-one')=>{
  const snapshot={id,setupKey:'dr',instrument:'EURUSD',direction:'short',knownAt,entry:{id,price:1.12,recognizedAt:knownAt,entryCategory:'risky'},
   checklist:{status:'ready',model:'countertrend',evaluatedAt:knownAt,checks:{m5Trend:{status:'passed',details:['original trend']}},setup:{primary:{targetSelection:{status:'passed',selectedAt:knownAt,target1:{price:1.11},details:['original selection '.repeat(15)]}}}},
   m1Check:{evaluatedAt:knownAt,details:['actual original check '.repeat(15)],currentTrend:{trend:'downtrend'},structure:{pivots:heavy}},evidence:heavy};
  return {id:hash(id),snapshot_id:id,instrument:'EURUSD',setup_key:'dr',known_at:iso(knownAt),captured_at:iso(knownAt+60),evaluated_through:iso(knownAt),configuration_id:config,evaluation_mode:'live',snapshot:packEvidence(snapshot,payloads,hash),observation:{}};
 };
 const first=make('one'),second=make('two',at+60,'config-two'),tables={setup2_live_snapshots:[first,second],setup2_live_payloads:[...payloads.values()],setup2_live_configurations:[{id:'config-one',configuration:{sessions:['original']}},{id:'config-two',configuration:{sessions:['changed']}}],setup2_alarm_events:[]},requests=[];
 const client={from(table){let fields='',filters=[],orders=[],take=Infinity,or='';const query={select(value){fields=value;return query;},eq(key,value){filters.push(row=>row[key]===value);return query;},gte(key,value){filters.push(row=>row[key]>=value);return query;},gt(key,value){filters.push(row=>row[key]>value);return query;},lt(key,value){filters.push(row=>row[key]<value);return query;},in(key,values){filters.push(row=>values.includes(row[key]));return query;},order(key){orders.push(key);return query;},limit(value){take=value;return query;},or(value){or=value;const match=value.match(/captured_at.gt.(.*),and\(captured_at.eq.(.*),id.gt.(.*)\)/);if(match)filters.push(row=>row.captured_at>match[1] || row.captured_at===match[2]&&row.id>match[3]);return query;},range(from,to){return Promise.resolve(result(from,to));},maybeSingle(){return Promise.resolve({...result(0,0),data:result(0,0).data[0]??null});},then(resolve,reject){return Promise.resolve(result(0,take-1)).then(resolve,reject);}};
  function result(from,to){requests.push({table,fields,from,to,or});let rows=(tables[table]??[]).filter(row=>filters.every(filter=>filter(row))).toSorted((a,b)=>{for(const key of orders){if(a[key]<b[key])return -1;if(a[key]>b[key])return 1;}return 0;});
   rows=rows.slice(from,Math.min(to+1,from+2,take)).map(row=>Object.fromEntries(fields.split(',').map(field=>{const [alias,path]=field.includes(':')?field.split(':'):[field,field];return [alias,path.split(/->>?/).reduce((value,key)=>value?.[key],row)??null];})));return {data:rows,error:null};}
  return query;
 }};
 return {client,tables,requests,first,second,make,payloads};
}
it('hydrates small review evidence but defers structure pools, then loads complete selected originals and exact configurations',async()=>{
 const f=fixture(),repo=createLiveEvidenceRepository(f.client),rows=await repo.metadata(run);
 expect(rows).toHaveLength(2);expect(rows[0].snapshot.checklist.setup.primary.targetSelection.details[0]).toContain('original selection');expect(rows[0].snapshot.m1Check.details[0]).toContain('actual original check');expect(rows[0].snapshot.m1Check.structure).toBeUndefined();
 const refsBefore=f.requests.filter(r=>r.table==='setup2_live_payloads').length,full=await repo.records([f.first.id,f.second.id]);
 expect(full[0].snapshot.evidence).toHaveLength(200);expect(full[0].snapshot.m1Check.structure.pivots).toHaveLength(200);expect(f.requests.filter(r=>r.table==='setup2_live_payloads').length).toBeGreaterThan(refsBefore);
 expect(await repo.configuration('config-one')).toEqual({sessions:['original']});expect(await repo.configuration('config-two')).toEqual({sessions:['changed']});
 const count=f.requests.length;await repo.records([f.first.id,f.second.id]);await repo.configuration('config-one');expect(f.requests).toHaveLength(count);
});
it('paginates by actual capped count and refreshes only after the captured-at/id cursor, retaining prior DR context once',async()=>{
 const f=fixture(),context=f.make('prior',at-20*86400);f.tables.setup2_live_snapshots.push(context);f.tables.setup2_live_payloads=[...f.payloads.values()];
 const repo=createLiveEvidenceRepository(f.client),initial=await repo.metadata(run);expect(initial).toHaveLength(3);
 const before=f.requests.length,next=f.make('new',at+120);f.tables.setup2_live_snapshots.push(next);f.tables.setup2_live_payloads=[...f.payloads.values()];
 const refreshed=await repo.metadata(run+':catchup');expect(refreshed).toHaveLength(4);expect(refreshed.every(row=>row.snapshot.runId===run+':catchup')).toBe(true);
 const reads=f.requests.slice(before).filter(r=>r.table==='setup2_live_snapshots');expect(reads.every(r=>r.or.includes('captured_at.gt.'))).toBe(true);
 expect(initial.find(row=>row.id===context.id).snapshot.knownAt).toBeLessThan(Date.parse('2026-09-30T22:00:00Z')/1000);
});
it('fails on missing referenced evidence and retries without caching an incomplete original',async()=>{
 const f=fixture(),repo=createLiveEvidenceRepository(f.client),all=f.tables.setup2_live_payloads;f.tables.setup2_live_payloads=[];
 await expect(repo.records([f.first.id])).rejects.toThrow('Live-Beleg fehlt');f.tables.setup2_live_payloads=all;expect((await repo.records([f.first.id]))[0].snapshot.evidence).toHaveLength(200);
});
it('loads all entries of a selected DR in a single bounded archive batch, without fabricated outcomes',async()=>{
 const f=fixture(),repo=createSetup2Repository(f.client);await repo.listReviewMetadata(run);const start=f.requests.length,entries=await repo.getRangeEntries(run,'dr');
 expect(entries.map(row=>row.snapshot.id)).toEqual(['one','two']);expect(entries.every(row=>row.results.every(result=>result.status==='notStored'&&result.netPnlUsd===null))).toBe(true);
 const reads=f.requests.slice(start).filter(r=>r.table==='setup2_live_snapshots');expect(reads).toHaveLength(2);expect(reads[0].fields.endsWith(',snapshot,observation')).toBe(true);expect(reads.map(r=>r.from)).toEqual([0,2]);
});
