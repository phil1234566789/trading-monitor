// Dieselbe isolierte PostgreSQL-WASM-Laufzeit wie beim Journaltest; keine entfernte Datenbank.
import {PGlite} from 'npm:@electric-sql/pglite@0.3.14';
import assert from 'node:assert/strict';
import {captureTradeSetupSourceSnapshot,assertTradeSetupSourceSnapshot,tradeSetupSweepSourceKey} from '../supabase/functions/_shared/tradeSetupSourceSnapshot.js';
const db=new PGlite();
await db.exec(`create role anon;
create table trade_setups(id bigint primary key,instrument text,direction text,ob_start_time timestamptz);
create table ob_zones(id bigint primary key,instrument text,direction text,timeframe text,top numeric,bottom numeric,start_time timestamptz);
create table pin_context(id bigint primary key,kind text,trade_setup_id bigint references trade_setups(id));
create table dealing_ranges(id bigint primary key,instrument text,trade_setup_id bigint references trade_setups(id));
create table trade_positions(id bigint primary key,dealing_range_id bigint references dealing_ranges(id));
create table trade_evidence(id bigint primary key,kind text,price numeric,range_low numeric,range_high numeric,timeframe text,
 source_time timestamptz,touched_time timestamptz,ob_zone_id bigint references ob_zones(id),dealing_range_id bigint,trade_position_id bigint);
insert into trade_setups values(9,'XAUUSD','short',to_timestamp(2400)),(10,'XAUUSD','short',to_timestamp(2700));
insert into dealing_ranges values(42,'XAUUSD',9);
`);
const migration=await Deno.readTextFile(new URL('../supabase/migrations/20261114160000_trade_setup_source_snapshots.sql',import.meta.url));
try{await db.exec(migration);}catch(error){console.error({message:error.message,position:error.position,internalPosition:error.internalPosition,internalQuery:error.internalQuery});throw error;}
const profile='ts11-ob-edge-p5-supersession-v1';
const pivot={price:100,dir:1,pivotTime:300,touchedTime:2100,touched:true,endTime:2100};
const ob={...pivot,sourceKind:'orderBlock',sourceStartTime:300,sourceKnownAt:900,sourceDirection:-1,sourceTop:100,sourceBottom:98};
const sw=(level:unknown)=>({timeframe:'5M',level});
const setup={dir:1,obStartTime:2400,obTop:103,obBottom:95,obFvg:1,pathType:'A',ls:ob,fractal:pivot,
 sweeps:[sw(ob),sw(pivot)],confirmationSources:[sw(ob),sw(pivot)],confirmationHistory:[{...sw(ob),status:'valid',validUntil:null}],
 sweepSourceProfile:profile,trendEvaluationVersion:'v2',trendEvidence:{goWitness:{...sw(pivot),
 sourceKey:tradeSetupSweepSourceKey(pivot,'5M'),knownAt:3000,ownerProof:{trend:'downtrend',depth:1,basis:'confirmedNestedRange',
 knownAt:3000,low:{price:90,pivotTime:1200},high:{price:110,pivotTime:1500}}}}};
const payload=await captureTradeSetupSourceSnapshot({setup,instrument:'XAUUSD',sourceProfile:profile,
 configuration:{params:{sweepSourceProfile:profile}},canonicalSetupKnownAt:3000,evaluationAsOf:3600});
const valid=async(p:unknown)=>(await db.query<{valid:boolean}>('select valid_ts_source_snapshot($1::jsonb) valid',[JSON.stringify(p)])).rows[0].valid;
assert.equal(await valid(payload),true);
const mutations=[
 (p:any)=>delete p.sourceProfile,(p:any)=>p.setup.dir='1',(p:any)=>p.setup.obStartTime=2400.5,
 (p:any)=>p.canonicalSetupKnownAt=4000,(p:any)=>p.frozenAt=4000,(p:any)=>p.setup.ls.sourceDirection=1,
 (p:any)=>p.setup.ls.sourceKnownAt=2200,(p:any)=>p.setup.fractal.price='NaN',
 (p:any)=>p.setup.trendEvidence.goWitness.ownerProof=null,
 (p:any)=>p.setup.trendEvidence.goWitness.ownerProof.knownAt=3001,
 (p:any)=>p.setup.trendEvidence.goWitness.sourceKey='foreign',
 (p:any)=>p.setup.confirmationHistory[0].level.sourceKnownAt=1200,
];
for(const mutate of mutations){const bad=structuredClone(payload);mutate(bad);
 assert.throws(()=>assertTradeSetupSourceSnapshot(bad));assert.equal(await valid(bad),false);}
const cases=JSON.parse(await Deno.readTextFile(new URL('./fixtures/tradeSetupSourceSqlCases.json',import.meta.url)));
for(const c of cases.validCases){
 assertTradeSetupSourceSnapshot(c.payload);assert.equal(await valid(c.payload),true,c.id);
 for(const mutation of cases.invalidMutations){
  const bad=structuredClone(c.payload);
  for(const patch of mutation.patch){const parts=patch.path.slice(1).split('/');let target=bad;
   for(const part of parts.slice(0,-1))target=target[part];
   if(patch.op==='remove')delete target[parts.at(-1)!];else target[parts.at(-1)!]=patch.value;
  }
  assert.throws(()=>assertTradeSetupSourceSnapshot(bad),c.id+mutation.id);
  assert.equal(await valid(bad),false,c.id+mutation.id);
 }
}
const inserted=await db.query<{id:number}>('insert into trade_setup_source_snapshots(trade_setup_id,payload) values(9,$1::jsonb) returning id',[JSON.stringify(payload)]);
const id=inserted.rows[0].id;
await assert.rejects(()=>db.query('update trade_setup_source_snapshots set payload=$1::jsonb where id=$2',[JSON.stringify(payload),id]),/immutable/);
await db.query('insert into pin_context values(1,\'trade_setup\',9,$1)',[id]);
await assert.rejects(()=>db.query('insert into pin_context values(2,\'trade_setup\',10,$1)',[id]),/foreign key/);
await assert.rejects(()=>db.query('insert into pin_context values(3,\'ob_zone\',9,$1)',[id]),/check constraint/);
await db.exec('insert into pin_context values(4,\'trade_setup\',9,null)');
await assert.rejects(()=>db.query('insert into trade_setup_source_snapshots(trade_setup_id,payload) values(10,$1::jsonb)',[JSON.stringify(payload)]),/does not belong/);
await db.exec(`insert into ob_zones values(1,'XAUUSD','short','5M',100,98,to_timestamp(300)),
 (2,'GBPUSD','short','5M',100,98,to_timestamp(300));`);
const edge={role:'orderBlockEdgeSweep',level:ob,timeframe:'5M'};
const evidence=(zone=1,price=100,context=edge)=>db.query(`insert into trade_evidence
 (id,kind,price,range_low,range_high,timeframe,source_time,touched_time,ob_zone_id,dealing_range_id,source_context)
 values(1,'ob',$1,98,100,'5M',to_timestamp(300),to_timestamp(2100),$2,42,$3::jsonb)`,[price,zone,JSON.stringify(context)]);
await evidence();await db.exec('delete from trade_evidence');
await assert.rejects(()=>evidence(1,99),/does not match/);
await assert.rejects(()=>evidence(2),/does not match/);
await assert.rejects(()=>evidence(1,100,{...edge,level:{...ob,sourceKind:'liquidity'}}),/check constraint/);
await db.close();
console.log(`Source migration: ${cases.validCases.length} valid native/H1 cases, ${mutations.length+cases.validCases.length*cases.invalidMutations.length} Codec/SQL mutations, OB-edge evidence guards and immutable parent/kind/legacy boundaries passed.`);
