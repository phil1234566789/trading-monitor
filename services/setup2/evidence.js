import {observeCapturedRanges} from './priceObservations.js';
import {packEvidence} from './evidencePayload.js';
import {createHash} from 'node:crypto';
import {buildTradeSetup2CandidateSnapshot} from '../../src/tradeSetup2Snapshot.js';
import {SETUP2_VERSION} from '../../src/tradeSetup2Configuration.js';
import {ENTRY_PATTERN_1_VERSION} from '../../src/entryPattern1Conditions.js';
import {M1_STRUCTURE_PERIOD} from '../../src/m1StructureSettings.js';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const iso=sec=>new Date(sec*1000).toISOString();

// Originalwissen bleibt unverändert; später finalisierte Verläufe tragen einen eigenen as-of-Stand.
export function createLiveEvidence(config,{fromTime,toTime,startedAt,mode}) {
 const configuration={schemaVersion:1,setupVersion:SETUP2_VERSION,entryPattern:ENTRY_PATTERN_1_VERSION,m1Period:M1_STRUCTURE_PERIOD,...config},configurationId=hash(configuration),originals=new Map(),payloads=new Map(),origins=new Map();
 const evaluationMode=mode ?? (fromTime<Math.floor(startedAt/60)*60-60?'catchup':'live');
 function record(snapshot) {
  if(!snapshot?.id || !Number.isFinite(snapshot.knownAt) || snapshot.knownAt<fromTime || snapshot.knownAt>toTime)return;
  const {checklistHistory,rangeCourse,priceObservation,...original}=snapshot;
  const primary=snapshot.checklist?.setup?.primary,targets=primary?.targetSelection;
  if(snapshot.dealingRange?.status==='validated' && Number.isFinite(targets?.target1?.price) && !origins.has(snapshot.setupKey))
   origins.set(snapshot.setupKey,{setupKey:snapshot.setupKey,originSnapshotId:snapshot.id,validatedAt:snapshot.knownAt,sourceValidatedAt:primary.validatedAt,
    target1:targets.target1.price,target2:targets.target2?.price ?? null,invalidation:primary.invalidation,direction:snapshot.direction});
  originals.set(snapshot.id,packEvidence(original,payloads,hash));
 }
 return {configurationId,evaluationMode,record,recordMinute:minute=>{
  const snapshot=minute.snapshot ?? buildTradeSetup2CandidateSnapshot({checklist:minute.checklist,candidate:minute.checklist?.setup?.primary});
  if(snapshot){
   const original={...snapshot,m1Check:minute.check};
   record(original);
  }
 },complete:(finalized=[],options={})=>{
  const priceState=options.m5Candles?observeCapturedRanges({origins:[...origins.values()],previous:options.previous,m5Candles:options.m5Candles,
   sessionConfigs:config.sessions,instrument:config.instrument,toTime,configurationId}):options.previous ?? {};
  const byId=new Map(finalized.map(s=>[s.id,s])),byRange=new Map(finalized.map(s=>[s.setupKey,s]));
  const last=new Map();for(const s of originals.values())if(!last.has(s.setupKey)||s.knownAt>=last.get(s.setupKey).knownAt)last.set(s.setupKey,s);
  const snapshots=[...originals.values()].map(snapshot=>{
   const final=last.get(snapshot.setupKey)===snapshot?(byId.get(snapshot.id) ?? byRange.get(snapshot.setupKey) ?? {}):{};
   const observation=Object.fromEntries(['checklistHistory','rangeCourse','priceObservation'].filter(k=>final[k]!=null).map(k=>[k,final[k]]));
   if(last.get(snapshot.setupKey)===snapshot && priceState[snapshot.setupKey])Object.assign(observation,{priceObservation:priceState[snapshot.setupKey].observation,coverage:priceState[snapshot.setupKey].coverage});
   return {id:hash([snapshot.id,toTime,configurationId,evaluationMode]),snapshot_id:snapshot.id,instrument:snapshot.instrument,
    setup_key:snapshot.setupKey,known_at:iso(snapshot.knownAt),evaluated_through:iso(toTime),
    evaluation_mode:evaluationMode,snapshot,observation:packEvidence(observation,payloads,hash)};
  });
  return {configuration:{id:configurationId,configuration},snapshots,payloads:[...payloads.values()],priceState:Object.fromEntries([...origins.keys()].map(key=>[key,priceState[key]]).filter(([,value])=>value))};
 }};
}
