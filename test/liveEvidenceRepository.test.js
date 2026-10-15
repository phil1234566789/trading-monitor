import {it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {createLiveEvidenceRepository} from '../src/liveEvidenceRepository.js';
import {createSetup2Repository} from '../src/setup2Repository.js';
import {DEALING_RANGE_VERSION} from '../src/tradeSetup2DealingRange.js';
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
 const client={from(table){let fields='',filters=[],constraints=[],orders=[],take=Infinity,or='';const query={select(value){fields=value;return query;},eq(key,value){constraints.push(['eq',key,value]);filters.push(row=>row[key]===value);return query;},gte(key,value){filters.push(row=>row[key]>=value);return query;},gt(key,value){filters.push(row=>row[key]>value);return query;},lt(key,value){filters.push(row=>row[key]<value);return query;},in(key,values){constraints.push(['in',key,values]);filters.push(row=>values.includes(row[key]));return query;},order(key){orders.push(key);return query;},limit(value){take=value;return query;},or(value){or=value;const match=value.match(/captured_at.gt.(.*),and\(captured_at.eq.(.*),id.gt.(.*)\)/);if(match)filters.push(row=>row.captured_at>match[1] || row.captured_at===match[2]&&row.id>match[3]);return query;},range(from,to){return Promise.resolve(result(from,to));},maybeSingle(){return Promise.resolve({...result(0,0),data:result(0,0).data[0]??null});},then(resolve,reject){return Promise.resolve(result(0,take-1)).then(resolve,reject);}};
  function result(from,to){requests.push({table,fields,from,to,or,constraints});const source=table==='setup2_live_snapshot_index'?tables.setup2_live_snapshots.map(row=>({...row,direction:row.snapshot.direction,entry_id:row.snapshot.entry?.id ?? null,dr_version:row.snapshot.dealingRange?.version ?? null,dr_status:row.snapshot.dealingRange?.status ?? null,has_observation:Object.keys(row.observation).length>0,has_history:row.observation.checklistHistory!=null})):tables[table]??[];let rows=source.filter(row=>filters.every(filter=>filter(row))).toSorted((a,b)=>{for(const key of orders){if(a[key]<b[key])return -1;if(a[key]>b[key])return 1;}return 0;});
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
 const reads=f.requests.slice(before).filter(r=>r.table==='setup2_live_snapshot_index');expect(reads.every(r=>r.or.includes('captured_at.gt.'))).toBe(true);
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

it('offers one month and unites both modes, while resolving original catchup pins to their unchanged archive row',async()=>{
 const f=fixture(),late=f.make('late-entry',at+120);late.evaluation_mode='catchup';
 const duplicate={...f.first,id:hash('late-copy'),evaluation_mode:'catchup'};
 f.tables.setup2_live_snapshots.push(duplicate,late);f.tables.setup2_live_payloads=[...f.payloads.values()];
 const repo=createSetup2Repository(f.client),options=await repo.listRuns();
 expect(options.filter(option=>option.id==='live-watcher:2026-10')).toHaveLength(1);expect(options.some(option=>option.id.endsWith(':catchup'))).toBe(false);
 const snapshots=await repo.listReviewMetadata(run);expect(snapshots).toHaveLength(3);expect(snapshots.find(snapshot=>snapshot.id==='one').evaluationMode).toBe('live');
 const linked=await repo.getEntry(run+':catchup','late-entry');expect(linked.snapshot.runId).toBe(run);expect(linked.snapshot.evaluationMode).toBe('catchup');
 const origin=await repo.getLiveSnapshotPin(duplicate.id);expect(origin.evidenceRecordId).toBe(duplicate.id);expect(origin.evaluationMode).toBe('catchup');
});

it('reads bounded packed manifests without repeated SQL JSON projections and excludes unused evidence before hydration',async()=>{
 const f=fixture();f.first.snapshot.m1Check.structure={$liveEvidenceRef:'f'.repeat(64)};
 f.first.observation.checklistHistory={version:'test',stages:{$liveEvidenceRef:'e'.repeat(64)}};
 const rows=await createLiveEvidenceRepository(f.client).metadata(run);
 expect(rows).toHaveLength(2);expect(rows[0].hasHistory).toBe(true);
 const reads=f.requests.filter(r=>r.table==='setup2_live_snapshots');
 expect(reads.length).toBeGreaterThan(1);expect(reads.every(r=>!r.fields.includes('->')&&r.fields.endsWith(',snapshot,observation')&&r.constraints.some(([op,key,ids])=>op==='in'&&key==='id'&&ids.length<=64))).toBe(true);
 expect(rows[0].snapshot.m1Check.structure).toBeUndefined();expect(rows[0].observation.checklistHistory).toBeUndefined();
});

it('coalesces concurrent month refreshes and never downloads an unselected month manifest for dropdown counts',async()=>{
 const f=fixture(),repo=createSetup2Repository(f.client);
 const [one,two]=await Promise.all([repo.listReviewMetadata(run),repo.listReviewMetadata(run+':catchup')]);
 expect(one).toEqual(two);expect(f.requests.filter(r=>r.table==='setup2_alarm_events')).toHaveLength(1);
 const before=f.requests.length;expect(await repo.listRunDrCounts([run,'live-watcher:2026-09'])).toEqual(new Map([[run,1],['live-watcher:2026-09',0]]));
 const counts=f.requests.slice(before);expect(counts.length).toBeGreaterThan(0);expect(counts.every(r=>['setup2_live_snapshot_index','setup2_alarm_events'].includes(r.table)&&r.fields==='setup_key')).toBe(true);
});

it('resolves the reported chart entry through an exact identity lookup and only its DR, including siblings',async()=>{
 const f=fixture(),id='EURUSD:EURUSD:setup1:19982:countertrend-entry-model-1-v10:1792053180';
 f.first.snapshot_id=id;f.first.snapshot.id=id;f.first.snapshot.entry.id=id;
 for(const row of [f.first,f.second]){row.setup_key='EURUSD:setup1:19982';row.snapshot.setupKey=row.setup_key;}
 const other=f.make('other');other.setup_key='EURUSD:setup1:other';other.snapshot.setupKey=other.setup_key;f.tables.setup2_live_snapshots.push(other);f.tables.setup2_live_payloads=[...f.payloads.values()];
 const repo=createSetup2Repository(f.client),entry=await repo.getEntry(run,id),siblings=await repo.getRangeEntries(run,entry.snapshot.setupKey);
 expect(entry.snapshot.id).toBe(id);expect(siblings.map(row=>row.snapshot.id)).toEqual([id,'two']);
 const indexReads=f.requests.filter(r=>r.table==='setup2_live_snapshot_index');expect(indexReads.every(r=>r.constraints.some(([op,key,value])=>op==='eq'&&key==='setup_key'&&value==='EURUSD:setup1:19982')||r.constraints.some(([op,key,values])=>op==='in'&&key==='setup_key'&&values.every(value=>value==='EURUSD:setup1:19982')))).toBe(true);
 expect(f.requests.filter(r=>r.table==='setup2_live_snapshots').some(r=>r.constraints.some(([op,key,value])=>op==='eq'&&key==='snapshot_id'&&value===id))).toBe(true);
 expect(f.requests.filter(r=>r.table==='setup2_live_snapshots'&&r.fields.includes('snapshot,observation')).every(r=>r.constraints.some(([op,key,values])=>op==='in'&&key==='id'&&!values.includes(other.id)))).toBe(true);
 await expect(repo.getEntry(run,'missing-entry')).resolves.toBeNull();
});

it('keeps a nonlisted minute checkpoint available by its exact original ID',async()=>{
 const f=fixture();f.tables.setup2_live_snapshots=Array.from({length:30},(_,i)=>{const row=f.make('stand:'+i,at+i*60);delete row.snapshot.entry;row.snapshot.dealingRange={version:DEALING_RANGE_VERSION,status:'validated'};return row;});f.tables.setup2_live_payloads=[...f.payloads.values()];
 const repo=createSetup2Repository(f.client),list=await repo.listReviewMetadata(run);expect(list.map(row=>row.id)).not.toContain('stand:15');
 const exact=await repo.getSetupSnapshot(run,'stand:15');expect(exact.id).toBe('stand:15');expect(exact.m1Check.structure.pivots).toHaveLength(200);
 expect(list).toHaveLength(2);
});
