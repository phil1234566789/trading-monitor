import {tradeSetupProvenance} from './tradeSetupProvenance.js';

export const TRADE_SETUP_SOURCE_SNAPSHOT_VERSION='trade-setup-source-snapshot-v1';
export const TRADE_SETUP_OB_SWEEP_PROFILE='ts11-ob-edge-p5-supersession-v1';
const PROFILE=TRADE_SETUP_OB_SWEEP_PROFILE;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const time=value=>Number.isSafeInteger(value)&&value>0;
const positive=value=>Number.isFinite(value)&&value>0;
const fail=()=>{throw new Error('Ungültiger TS1.1-Quellen-Snapshot.');};

export function tradeSetupSweepSourceKey(level,timeframe='5M') {
 return [level.sourceKind??'liquidity',timeframe,level.dir,level.pivotTime,level.price,level.touchedTime].join(':');
}

function jsonValue(value,stack=new Set(),depth=0) {
 if(depth>64||value===undefined||typeof value==='function'||typeof value==='symbol'||typeof value==='bigint')return fail();
 if(typeof value==='number'&&!Number.isFinite(value))return fail();
 if(typeof value==='string'&&value.includes('\0'))return fail();
 if(value===null||typeof value!=='object')return value;
 if(!Array.isArray(value)&&![Object.prototype,null].includes(Object.getPrototypeOf(value)))return fail();
 if(stack.has(value))return fail();stack.add(value);
 const result=Array.isArray(value)?value.map(v=>jsonValue(v,stack,depth+1))
  :Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).map(([key,v])=>[
   key.includes('\0')?fail():key,
   key==='endTime'&&v===Infinity&&value.touched===false?null:jsonValue(v,stack,depth+1)]));
 stack.delete(value);return result;
}

function assertLevel(level,dir,asOf,{fractal=false,timeframe='5M'}={}) {
 if(!object(level)||!positive(level.price)||level.dir!==dir||!time(level.pivotTime)||level.pivotTime>asOf
  ||!['liquidity','orderBlock'].includes(level.sourceKind??'liquidity'))return fail();
 if(!fractal||level.touched){
  const fine=level.fineTouchedTime,touch=fine??level.touchedTime,duration=timeframe==='1H'&&fine==null?3600:300;
  if(level.touched!==true||!time(level.touchedTime)||!time(touch)||touch<=level.pivotTime
   ||(fine!=null&&(fine<level.touchedTime||fine>=level.touchedTime+(timeframe==='1H'?3600:300)))
   ||touch+duration>asOf)return fail();
 }else if(level.touched!==false||level.touchedTime!==null)return fail();
 if(level.recognizedAt!=null&&(!time(level.recognizedAt)||level.recognizedAt>asOf))return fail();
 if(level.sourceKind==='orderBlock'&&(!time(level.sourceStartTime)||level.pivotTime!==level.sourceStartTime
  ||!time(level.sourceKnownAt)||level.sourceKnownAt<level.sourceStartTime+600||level.sourceKnownAt>level.touchedTime
  ||level.sourceDirection!==-dir||!positive(level.sourceTop)||!positive(level.sourceBottom)||level.sourceTop<=level.sourceBottom
  ||level.price!==(dir===1?level.sourceTop:level.sourceBottom)||timeframe!=='5M'))return fail();
 return level;
}

function assertSweep(sweep,dir,asOf) {
 if(!object(sweep)||!['5M','1H'].includes(sweep.timeframe))return fail();
 assertLevel(sweep.level,dir,asOf,{timeframe:sweep.timeframe});
 if(sweep.sourceKey!=null&&sweep.sourceKey!==tradeSetupSweepSourceKey(sweep.level,sweep.timeframe))return fail();
 return sweep;
}

const sameLevelProof=(a,b)=>['sourceKind','dir','price','pivotTime','touchedTime','fineTouchedTime','recognizedAt',
 'sourceStartTime','sourceKnownAt','sourceDirection','sourceTop','sourceBottom']
 .every(key=>(key==='sourceKind'?(a[key]??'liquidity'):(a[key]??null))===(key==='sourceKind'?(b[key]??'liquidity'):(b[key]??null)));

function assertOwnerProof(proof,dir,asOf,source) {
 const range=proof?.range??proof,expected=dir===1?'downtrend':'uptrend';
 const basis=proof?.range?['deepestRangeAtLevelBirth','rangeBoundaryBeforeSweep','protectedPivotBeforeSweep']
  :['confirmedNestedRange','existingCloseReactionChoch'];
 if(!object(proof)||!basis.includes(proof.basis)||!time(proof.knownAt)||proof.knownAt>asOf
  // Tiefe 0 = Wurzel: seit v7 darf sie die LS belegen (findTradeSetup11SourceOwner, counterAfterLevel).
  ||!Number.isSafeInteger(proof.depth)||proof.depth<(proof.basis==='deepestRangeAtLevelBirth'?0:1)||range?.trend!==expected
  // CHoCH-knownAt bezeichnet den ersten Trendbeleg, die Range kann bis zum erfassten Präfix weiterlaufen.
  ||![range.low,range.high].every(p=>object(p)&&positive(p.price)&&time(p.pivotTime)&&p.pivotTime<=asOf)
  ||range.low.price>=range.high.price||(proof.range&&proof.status!=='ready'))return fail();
 if(proof.range&&(!object(proof.pivot)||!positive(proof.pivot.price)||!time(proof.pivot.pivotTime)||proof.pivot.pivotTime>proof.knownAt))return fail();
 if(proof.range&&(proof.pivot.price!==source.price||(source.sourceKind==='orderBlock'
  ?proof.sourceKind!=='orderBlock'||proof.sourceStartTime!==source.sourceStartTime
  :proof.pivot.pivotTime!==source.pivotTime)))return fail();
 if(proof.confirmation&&(!time(proof.confirmation.recognizedAt)||proof.confirmation.recognizedAt>proof.knownAt))return fail();
}

export function assertTradeSetupSourceSnapshot(payload) {
 const clean=jsonValue(payload),serialized=JSON.stringify(clean);
 if(new TextEncoder().encode(serialized).length>131072||!object(payload)||payload.schemaVersion!==TRADE_SETUP_SOURCE_SNAPSHOT_VERSION
  ||payload.sourceProfile!==PROFILE||!['XAUUSD','GBPUSD','EURUSD'].includes(payload.instrument)
  ||!time(payload.canonicalSetupKnownAt)||!time(payload.evaluationAsOf)||payload.canonicalSetupKnownAt>payload.evaluationAsOf
  ||payload.frozenAt!==payload.evaluationAsOf||!/^([a-f0-9]{64})$/.test(payload.settingsHash??'')
  ||typeof payload.engineVersion!=='string'||!payload.engineVersion||payload.engineVersion.length>128)return fail();
 const setup=payload.setup,dir=setup?.dir;
 if(!object(setup)||![1,-1].includes(dir)||!time(setup.obStartTime)||setup.obStartTime+600>payload.canonicalSetupKnownAt
  ||!positive(setup.obTop)||!positive(setup.obBottom)||setup.obTop<=setup.obBottom||!positive(setup.obFvg)
  ||(setup.trendEvaluationSourceProfile??setup.sweepSourceProfile)!==PROFILE||!['A','B'].includes(setup.pathType)
  ||payload.setupKey!==`${payload.instrument}:${dir}:${setup.obStartTime}`||setup.trendEvaluationVersion!==payload.engineVersion
  ||(setup.instrument!=null&&setup.instrument!==payload.instrument)
  ||!Array.isArray(setup.sweeps)||setup.sweeps.length<1||setup.sweeps.length>3
  ||!Array.isArray(setup.confirmationSources)||!setup.confirmationSources.length)return fail();
 const asOf=payload.canonicalSetupKnownAt;
 for(const sweep of [...setup.sweeps,...setup.confirmationSources])assertSweep(sweep,dir,asOf);
 assertLevel(setup.ls,dir,asOf,{timeframe:setup.sweeps[0].timeframe});
 assertLevel(setup.fractal,dir,asOf,{fractal:true,
  timeframe:sameLevelProof(setup.fractal,setup.ls)?setup.sweeps[0].timeframe:'5M'});
 const sourceKeys=setup.confirmationSources.map(s=>tradeSetupSweepSourceKey(s.level,s.timeframe));
 const proofs=new Map();
 const remember=sweep=>{
  const key=tradeSetupSweepSourceKey(sweep.level,sweep.timeframe);
  if(proofs.has(key)&&!sameLevelProof(proofs.get(key),sweep.level))return fail();
  proofs.set(key,sweep.level);
 };
 for(const sweep of [...setup.sweeps,...setup.confirmationSources,{level:setup.ls,timeframe:setup.sweeps[0].timeframe}])remember(sweep);
 if(new Set(sourceKeys).size!==sourceKeys.length||tradeSetupSweepSourceKey(setup.ls,setup.sweeps[0].timeframe)
  !==tradeSetupSweepSourceKey(setup.sweeps[0].level,setup.sweeps[0].timeframe)
  ||!sameLevelProof(setup.ls,setup.sweeps[0].level)
  ||setup.sweeps.some(s=>!setup.confirmationSources.some(c=>c.timeframe===s.timeframe&&sameLevelProof(c.level,s.level))))return fail();
 if(setup.confirmationHistory!=null){
  if(!Array.isArray(setup.confirmationHistory))return fail();
  for(const item of setup.confirmationHistory){
   assertSweep(item,dir,asOf);
   remember(item);
   if(!['valid','unknown','superseded'].includes(item.status))return fail();
   if(item.status==='superseded'){
    if(item.timeframe!=='5M')return fail();
    const next=item.supersededBy;
    if(!time(item.validUntil)||item.validUntil>asOf||!object(next)||!time(next.knownAt)||next.knownAt>item.validUntil
     ||next.validUntil!==item.validUntil)return fail();
    assertLevel(next.level,dir,asOf);
    if(next.sourceKey!==tradeSetupSweepSourceKey(next.level,'5M')||next.knownAt<=next.level.pivotTime||next.level.pivotTime<=item.level.touchedTime
     ||next.level.touchedTime+300!==item.validUntil||next.level.sourceKind==='orderBlock'||item.level.sourceKind==='orderBlock'
     ||!(dir===1?next.level.price>item.level.price:next.level.price<item.level.price))return fail();
    remember({level:next.level,timeframe:'5M'});
   }else if(item.validUntil!==null)return fail();
   if(sourceKeys.includes(tradeSetupSweepSourceKey(item.level,item.timeframe))&&item.status!=='valid')return fail();
  }
 }
 const witness=setup.trendEvidence?.goWitness;
 if(!object(witness)||!time(witness.knownAt)||witness.knownAt>payload.evaluationAsOf)return fail();
 assertSweep(witness,dir,asOf);
 assertOwnerProof(witness.ownerProof,dir,asOf,witness.level);remember(witness);
 if(!sourceKeys.includes(witness.sourceKey)||witness.sourceKey!==tradeSetupSweepSourceKey(witness.level,witness.timeframe)
  ||!setup.confirmationSources.some(c=>c.timeframe===witness.timeframe&&sameLevelProof(c.level,witness.level)))return fail();
 return payload;
}

// Der Snapshot friert den Stand bei canonicalSetupKnownAt ein. Das Live-Setup trägt den späteren Touch seines Fraktals (Pin aus dem
// Replay nach der Invalidierung, Long #4 05.11.); der gehört nicht in die Quellen und würde die Prüfung sonst immer reißen.
function fractalAsOf(setup,asOf) {
 const fractal=setup?.fractal;
 if(!object(fractal)||fractal.touched!==true||fractal===setup.ls||(fractal.fineTouchedTime??fractal.touchedTime)+300<=asOf)return setup;
 const {fineTouchedTime,...open}=fractal;
 return {...setup,fractal:{...open,touched:false,touchedTime:null,endTime:null}};
}

export async function captureTradeSetupSourceSnapshot({setup,instrument,sourceProfile,configuration,canonicalSetupKnownAt,evaluationAsOf}) {
 if(!object(configuration)||sourceProfile!==PROFILE
  ||(configuration.params?.sweepSourceProfile!=null&&configuration.params.sweepSourceProfile!==sourceProfile))return fail();
 const normalized=fractalAsOf(jsonValue(setup),canonicalSetupKnownAt);
 const provenance=await tradeSetupProvenance({source:'manual',configuration:{...configuration,sourceProfile}});
 const payload={schemaVersion:TRADE_SETUP_SOURCE_SNAPSHOT_VERSION,sourceProfile,instrument,
  setupKey:`${instrument}:${setup?.dir}:${setup?.obStartTime}`,engineVersion:setup?.trendEvaluationVersion,
  canonicalSetupKnownAt,evaluationAsOf,frozenAt:evaluationAsOf,settingsHash:provenance.config_hash,setup:normalized};
 return assertTradeSetupSourceSnapshot(payload);
}

export function restoreTradeSetupSourceSnapshot(payload) {
 assertTradeSetupSourceSnapshot(payload);
 return restoreTradeSetupSourceReferences(payload.setup);
}

// Der Worker liefert neue native Projektionen als JSON; offene Enden und echte Aliase bleiben Anzeige-Vertrag.
export function restoreTradeSetupSourceReferences(value) {
 const setup=jsonValue(value),sources=new Map();
 const intern=(level,timeframe='5M')=>{
  if(level.endTime===null&&level.touched===false)level.endTime=Infinity;
  const key=tradeSetupSweepSourceKey(level,timeframe);
  if(!sources.has(key))sources.set(key,level);
  return sources.get(key);
 };
 setup.ls=intern(setup.ls,setup.sweeps[0].timeframe);
 for(const list of [setup.sweeps,setup.confirmationSources,setup.confirmationHistory??[]])for(const sweep of list){
  sweep.level=intern(sweep.level,sweep.timeframe);
  if(sweep.supersededBy)sweep.supersededBy.level=intern(sweep.supersededBy.level);
 }
 setup.fractal=intern(setup.fractal,sameLevelProof(setup.fractal,setup.ls)?setup.sweeps[0].timeframe:'5M');
 if(setup.trendEvidence?.goWitness)setup.trendEvidence.goWitness.level=intern(setup.trendEvidence.goWitness.level,setup.trendEvidence.goWitness.timeframe);
 return setup;
}
