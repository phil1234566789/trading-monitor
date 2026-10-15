import {it,expect,vi} from 'vitest';
import {createSetup2Repository} from '../src/setup2Repository.js';
import {createLinkedSnapshotReader} from '../src/tradeSetup2LinkedSnapshot.js';
import {simulationAsOf} from '../src/tradeSetupSimulationRepository.js';
import {tradeSetup2Positions} from '../src/tradeSetup2Positions.js';
const run='live-watcher:2026-10',at=Date.parse('2026-10-09T07:28:00Z')/1000;
const events=['one','two'].map((id,i)=>({id:'event-'+id,kind:'trading',stage:3,instrument:'EURUSD',direction:'short',setup_key:'dr',signal_at:new Date((at+i*60)*1000).toISOString(),
 payload:{entry:{id,setupKey:'dr',direction:'short',recognizedAt:at+i*60,price:1.12,entryPattern:'countertrend-entry-model-1-v10',entryCategory:'risky'},variants:[{variant:'wide',lots:3,fullLots:7,entryCategory:'risky'}]}}));
function client(){const reads=[],db={rpc:vi.fn(),from:vi.fn(table=>{const q={};for(const key of ['select','eq','gt','gte','lt','order'])q[key]=()=>q;q.range=async(start,end)=>{reads.push([table,start,end]);return {data:table==='setup2_alarm_events'&&start===0?events:[],error:null};};return q;})};return {db,reads};}
it('loads the same original entries through the regular linked-snapshot reader without invented run inputs',async()=>{
 const {db,reads}=client(),repo=createSetup2Repository(db),before=JSON.stringify(events),record=await createLinkedSnapshotReader(repo)(run,'one');
 expect(record.snapshots.map(s=>s.id)).toEqual(['one','two']);expect(record.results).toHaveLength(4);
 expect(record.snapshot.entry.entryPattern).toBe('countertrend-entry-model-1-v10');expect(record.snapshot.checklist).toBeUndefined();
 expect((await repo.getRun(run)).configuration.setupVersion).toBeUndefined();expect((await repo.getRun(run)).configuration.sessions).toBeUndefined();
 expect(await repo.listRunDrCounts([run])).toEqual(new Map([[run,1]]));expect(reads.every(([table])=>table==='setup2_alarm_events')).toBe(true);
 expect(JSON.stringify(events)).toBe(before);expect(db.rpc).not.toHaveBeenCalled();
 const rows=(await repo.listResults({runId:run,asOf:at})).map(r=>simulationAsOf(r,at));expect(rows).toHaveLength(2);
 expect(rows.every(r=>r.status==='notStored' && r.commissionUsd===null && r.netPnlUsd===null)).toBe(true);
 const positions=tradeSetup2Positions(rows,{instrument:'EURUSD',variant:'both',asOf:at+3600,candles:[{time:at+1800,close:2}]});
 expect(positions.every(p=>p.status==='notStored' && p.exitPrice===null && !p.isOpen)).toBe(true);
});
it('rejects accidental simulation writes for a live source before touching the database',()=>{
 const {db}=client(),repo=createSetup2Repository(db);
 expect(()=>repo.saveRun({id:run})).toThrow('nicht als Simulation');expect(()=>repo.saveEntries(run,[])).toThrow('nicht als Simulation');expect(()=>repo.saveSetups(run,[])).toThrow('nicht als Simulation');expect(db.rpc).not.toHaveBeenCalled();
});
