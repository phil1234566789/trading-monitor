import {expect,it,vi} from 'vitest';
import cases from '../scripts/fixtures/tradeSetupSourceSqlCases.json';
const db=vi.hoisted(()=>({snapshots:[],pins:[],writes:[]}));
vi.mock('../src/tradeIntake.js',()=>({findOrCreateTradeSetupId:vi.fn(async()=>9),findOrCreateObZoneId:vi.fn()}));
vi.mock('../src/supabaseClient.js',()=>({supabase:{from(table){
 const filters=[],q={select:()=>q,order:()=>q,eq:(k,v)=>{filters.push([k,v]);return q;},
  range:(from,to)=>{q.bounds=[from,to];return q;},
  upsert:(row,options)=>{q.write={row,options};return q;},update:row=>{q.update=row;return q;}};
 const run=()=>{
  const rows=table==='pin_context'?db.pins:db.snapshots;
  if(q.write){const {row,options}=q.write;db.writes.push({table,row:structuredClone(row),options});
   if(table==='trade_setup_source_snapshots'){
    const p=row.payload;rows.push({id:17,...structuredClone(row),source_profile:p.sourceProfile,settings_hash:p.settingsHash,
     canonical_setup_known_at:p.canonicalSetupKnownAt,evaluation_as_of:p.evaluationAsOf});
   }else rows.push({id:31,...structuredClone(row),created_at:'2026-11-14T15:00:00Z',
    trade_setups:{id:9,instrument:'XAUUSD',direction:'short',ob_top:row.fakeTop??103,ob_bottom:95,ob_start_time:'2026-11-05T14:35:00Z'}});
   q.write=null;
  }
  let selected=rows.filter(row=>filters.every(([k,v])=>row[k]===v));
  if(q.update){for(const row of selected)Object.assign(row,q.update);q.update=null;}
  selected=selected.map(row=>({...row,...(row.trade_setup_source_snapshot_id?{trade_setup_source_snapshots:{payload:db.snapshots.find(s=>s.id===row.trade_setup_source_snapshot_id)?.payload}}:{})}));
  if(q.bounds)selected=selected.slice(q.bounds[0],q.bounds[1]+1);
  return selected;
 };
 q.single=async()=>({data:run()[0],error:null});q.maybeSingle=q.single;
 q.then=resolve=>Promise.resolve({data:run(),error:null}).then(resolve);return q;
}}}));
import {addPinTscSetupEntry,fetchPinContext} from '../src/pinContext.js';
it('saves and reloads one frozen typed-source pin and preserves it when the same setup is pinned again',async()=>{
 const p=cases.validCases[0].payload,setup={...structuredClone(p.setup),sourceSnapshotContext:{
  configuration:{params:{sweepSourceProfile:p.sourceProfile}},canonicalSetupKnownAt:p.canonicalSetupKnownAt,evaluationAsOf:p.evaluationAsOf}};
 await addPinTscSetupEntry({instrument:p.instrument,direction:setup.dir===1?'short':'long',setup},'native source','bug');
 const [pin]=await fetchPinContext();
 expect(db.pins).toHaveLength(1);expect(db.snapshots).toHaveLength(1);
 expect(pin.tradeSetup.frozenSetup.ls).toEqual(p.setup.ls);
 expect(pin.tradeSetup.obTop).toBe(p.setup.obTop);
 expect(pin.tradeSetup.obBottom).toBe(p.setup.obBottom);
 expect(pin.tradeSetup.frozenSetup.confirmationHistory).toEqual(p.setup.confirmationHistory);
 expect(pin.tradeSetup.frozenSetup.trendEvidence.goWitness).toEqual(p.setup.trendEvidence.goWitness);
 const frozen=JSON.stringify(db.snapshots[0].payload);
 await addPinTscSetupEntry({instrument:p.instrument,direction:'short',setup:{...setup,changedLiveDiagnostic:true}},'updated note','bug');
 expect(db.pins).toHaveLength(1);expect(db.snapshots).toHaveLength(1);
 expect(JSON.stringify(db.snapshots[0].payload)).toBe(frozen);
 expect((await fetchPinContext())[0].note).toBe('updated note');
 db.snapshots=[];
 await expect(fetchPinContext()).rejects.toThrow(/Quellenstand/);
});
