import {tradeSetup11SourceTimes} from './tradeSetup11Context.js';
import {createTradeSetup11ContextResolver,currentTradeSetup11Range,findTradeSetup11SourceOwner} from './tradeSetup11Ownership.js';
import {createCloseReactionCache} from './m5CloseReactionHistory.js';
import {detectLiquidityLevels} from './liquidityDetection.js';
import {TRADE_SETUP_M5_FRACTAL_PERIOD} from './priceChartConstants.js';
import {detectSetupObs,TRADE_SETUP_OB_SWEEP_PROFILE} from './tradeSetup.js';
import {confirmedOrderBlockSweepSource,evaluateSweepConfirmation,sweepSourceKey} from './tradeSetupSweepSources.js';
import {obMinimum} from './instrumentConfig.js';
import {reconstructTradeSetup11Projection} from './tradeSetup11Projection.js';

export const TRADE_SETUP_11_VERSION='ts11-causal-inner-trend-ob-sources-p5-supersession-v4';

function contextEntry(resolvers,input,symbol) {
 if(!resolvers.has(symbol))resolvers.set(symbol,{resolve:createTradeSetup11ContextResolver({...input,instrument:symbol}),closeReactionCache:createCloseReactionCache()});
 return resolvers.get(symbol);
}

function assessTradeSetup11Sources({setups=[],instrument,m5Candles=[],h1Candles=[],d1Candles=[],
 evaluatedAt,settings={},sessionConfigs=[],contextResolvers}={}) {
 const resolvers=contextResolvers??new Map(),assessments=[];
 for(const setup of setups){
  const symbol=instrument??setup?.instrument,times=tradeSetup11SourceTimes(setup);
  const setupKey=`${symbol}:${setup?.dir}:${setup?.obStartTime}`;
  const evidence={version:TRADE_SETUP_11_VERSION,evaluatedAt:times.nativeGeometryKnownAt,
   sourceTimes:times,sourceLevel:setup?.ls?{price:setup.ls.price,pivotTime:setup.ls.pivotTime,touchedTime:setup.ls.touchedTime}:null};
  const finish=(status,reason,extra={})=>assessments.push({setupKey,setup,status,reason,
   knownAt:times.sourceKnownAt,trendEvidence:{...evidence,...extra}});
  if(!symbol||!Number.isFinite(evaluatedAt)||![1,-1].includes(setup?.dir)||times.status!=='ready'
   ||!Number.isFinite(setup.ls?.pivotTime)||!Number.isFinite(setup.ls?.price)||!Number.isFinite(setup.ls?.touchedTime)){
   finish('unknown',times.reason??'sourceContextUnknown');continue;
  }
  if(setup.instrument&&setup.instrument!==symbol){finish('unknown','sourceInstrumentMismatch');continue;}
  if(![setup.obTop,setup.obBottom].every(Number.isFinite)||setup.obTop<=setup.obBottom){finish('unknown','sourceGeometryUnknown');continue;}
  const timeframe=setup.sweeps?.[0]?.timeframe??'5M';
  if(typeof timeframe!=='string'){finish('unknown','sourceTimeframeUnknown');continue;}
  const sourceTimeframe=timeframe.toUpperCase();
  if(!['5M','1H'].includes(sourceTimeframe)){finish('unknown','sourceTimeframeUnknown');continue;}
  const touch=setup.ls.fineTouchedTime??setup.ls.touchedTime;
  const touchKnownAt=(sourceTimeframe==='5M'?setup.ls.touchedTime:touch)+300;
  if(!Number.isFinite(touch)||touch<setup.ls.touchedTime||(sourceTimeframe==='5M'&&touch>=setup.ls.touchedTime+300)
   ||setup.ls.dir!==setup.dir||setup.ls.pivotTime>=touch||touchKnownAt>times.nativeGeometryKnownAt
   ||(setup.ls.recognizedAt!=null&&(!Number.isFinite(setup.ls.recognizedAt)||setup.ls.recognizedAt>times.nativeGeometryKnownAt))){
   finish('unknown','sourceChronologyUnknown');continue;
  }
  if(times.sourceKnownAt>evaluatedAt){finish('unknown','sourceNotKnownYet');continue;}
  const {resolve:resolveContext,closeReactionCache}=contextEntry(resolvers,{m5Candles,h1Candles,d1Candles,settings,sessionConfigs},symbol),context=resolveContext(times.nativeGeometryKnownAt);
  if(context.status!=='ready'||context.stateKnownAt<times.nativeGeometryKnownAt){finish('unknown',context.reason??'m5ContextTailMissing');continue;}
  evidence.anchor=context.anchor;evidence.stateKnownAt=context.stateKnownAt;
  if(setup.ls.sourceKind==='orderBlock'){
   context.sourceObs??=detectSetupObs(context.rawCandles,obMinimum(symbol,'5m'));
   if(sourceTimeframe!=='5M'||!confirmedOrderBlockSweepSource(setup.ls,context.sourceObs,context.rawCandles,times.nativeGeometryKnownAt)){
    finish('unknown','sourceOrderBlockNotConfirmed');continue;
   }
  }else if(setup.ls.sourceKind!=null&&setup.ls.sourceKind!=='liquidity'){
   finish('unknown','sourceKindUnknown');continue;
  }else if(sourceTimeframe==='5M'){
   context.sourceLiquidity??=detectLiquidityLevels(context.candles,TRADE_SETUP_M5_FRACTAL_PERIOD);
   const known=(setup.dir===1?context.sourceLiquidity.highs:context.sourceLiquidity.lows)
    .some(p=>p.pivotTime===setup.ls.pivotTime&&p.price===setup.ls.price&&p.touched&&p.touchedTime===setup.ls.touchedTime);
   if(!known){finish('unknown','sourceLiquidityNotConfirmed');continue;}
  }
  if(setup.sweepSourceProfile===TRADE_SETUP_OB_SWEEP_PROFILE){
   context.sourceLiquidity??=detectLiquidityLevels(context.candles,TRADE_SETUP_M5_FRACTAL_PERIOD);
   const validity=evaluateSweepConfirmation(setup.ls,context.candles,times.nativeGeometryKnownAt,sourceTimeframe,
    setup.dir===1?context.sourceLiquidity.highs:context.sourceLiquidity.lows);
   if(validity.status!=='valid'){finish(validity.status==='superseded'?'unmet':'unknown',validity.reason,{sweepValidity:validity});continue;}
  }
  const current=currentTradeSetup11Range(context,closeReactionCache),expectedTrend=setup.dir===-1?'uptrend':'downtrend';
  if(!current){finish('unknown','innerTrendUnknown');continue;}
  // Läuft die aktuelle Range gegen das Setup, beginnt die Gegenbewegung an ihrem Ursprung (Low bei Short, High bei Long).
  // Ein LS-Pivot ab dort zählt auf keinem Quellenpfad, auch nicht über eine tiefere Range (P557 10:40).
  // Im Trend nicht: dort ist der Sweep des HL/LH nach dem Extrem genau das Setup (P489 „long im trend“).
  const counter=current.trend!==expectedTrend,counterOrigin=counter?(expectedTrend==='downtrend'?current.low:current.high)?.pivotTime:null;
  const beforeCounter=pivotTime=>!counter||Number.isFinite(counterOrigin)&&pivotTime<counterOrigin;
  const counterEvidence={currentRange:current,counterOrigin};
  // Mit dem Trend nur bei bestätigter Struktur (HH+HL bzw. LL+LH); ein Close-CHoCH markiert nur den Beginn der Gegenbewegung (P556, #54967).
  if(current.trend===expectedTrend&&current.basis==='confirmedNestedRange'){finish('passed','currentTrendDirection',counterEvidence);continue;}
  const owner=findTradeSetup11SourceOwner({setup,context,resolveContext,expectedTrend,current});
  const ownerPivot=owner.pivot?.pivotTime??setup.ls.pivotTime;
  if(owner.status==='ready'&&!beforeCounter(ownerPivot))finish('unmet','sourcePivotInCounterMove',{...counterEvidence,sourceOwner:owner});
  else if(owner.status==='ready')finish('passed','sourceRangeDirection',{...counterEvidence,sourceOwner:owner});
  else finish(owner.status==='unknown'?'unknown':'unmet',owner.reason,{...counterEvidence,sourceOwner:owner});
 }
 const counts=Object.fromEntries(['passed','unmet','unknown'].map(status=>[status,assessments.filter(a=>a.status===status).length]));
 return {version:TRADE_SETUP_11_VERSION,status:counts.unknown?'unknown':'ready',counts,assessments,
  setups:assessments.filter(a=>a.status==='passed').map(a=>({...a.setup,trendEvaluationVersion:TRADE_SETUP_11_VERSION,trendEvidence:a.trendEvidence}))};
}

export function filterTradeSetup11Candidates(input={}) {
 const variants=[],groups=[],contextResolvers=new Map();
 for(const setup of input.setups??[]){
  const profile=input.sweepSourceProfile??setup?.sweepSourceProfile;
  let projected=null,projectionReason=null;
  const times=tradeSetup11SourceTimes(setup),symbol=input.instrument??setup?.instrument;
  if(profile===TRADE_SETUP_OB_SWEEP_PROFILE&&setup?.sweepSourceProfile!==profile&&symbol
   &&times.status==='ready'&&times.sourceKnownAt<=input.evaluatedAt&&[1,-1].includes(setup.dir)
   &&[setup.obTop,setup.obBottom].every(Number.isFinite)&&setup.obTop>setup.obBottom
   &&(!setup.instrument||setup.instrument===symbol)){
   const context=contextEntry(contextResolvers,input,symbol).resolve(times.nativeGeometryKnownAt);
   const rebuilt=reconstructTradeSetup11Projection({setup,instrument:symbol,context});
   if(rebuilt.status==='ready')projected=rebuilt.setup;else projectionReason=rebuilt.reason;
  }
  const evaluated=projected?{...setup,...projected}:setup;
  const displayPrimary=evaluated?.sweeps?.[0];
  const mismatched=displayPrimary&&evaluated?.ls&&sweepSourceKey(displayPrimary.level,displayPrimary.timeframe)!==sweepSourceKey(evaluated.ls,displayPrimary.timeframe);
  const sources=mismatched?[{timeframe:displayPrimary.timeframe,level:evaluated.ls}]
   :profile===TRADE_SETUP_OB_SWEEP_PROFILE?(evaluated?.confirmationSources??evaluated?.sweeps??[])
    :evaluated?.ls?[{timeframe:displayPrimary?.timeframe??'5M',level:evaluated.ls}]:[];
  const unique=[...new Map(sources.filter(s=>s?.level).map(s=>[sweepSourceKey(s.level,s.timeframe),s])).values()];
  const start=variants.length;
  for(const source of unique)variants.push({...evaluated,...(profile?{sweepSourceProfile:profile}:{}),ls:source.level,sweeps:[source]});
  if(!unique.length)variants.push(evaluated);
  groups.push({setup,start,length:variants.length-start,sources:unique,profile,projected,projectionReason});
 }
 const raw=assessTradeSetup11Sources({...input,setups:variants,contextResolvers});
 const assessments=groups.map(group=>{
  const rows=raw.assessments.slice(group.start,group.start+group.length);
  const chosen=rows.find(r=>r.status==='passed')??rows.find(r=>r.status==='unknown')??rows[0];
  const index=rows.indexOf(chosen),witness=!group.projectionReason&&chosen.status==='passed'?group.sources[index]:null;
  return {...chosen,...(group.projectionReason?{status:'unknown',reason:group.projectionReason}:{}),
   ...(group.projected?{evaluatedSetupProjection:group.projected}:{}),setup:group.setup,trendEvidence:{...chosen.trendEvidence,...(group.profile?{sourceProfile:group.profile}:{}),
   goWitness:witness?{...witness,sourceKey:sweepSourceKey(witness.level,witness.timeframe),
    knownAt:chosen.knownAt,ownerProof:chosen.trendEvidence.sourceOwner??chosen.trendEvidence.currentRange}:null,
   sourceAssessments:rows.map(r=>({sourceKey:r.setup?.ls?sweepSourceKey(r.setup.ls,r.setup.sweeps?.[0]?.timeframe):null,status:r.status,reason:r.reason}))}};
 });
 const counts=Object.fromEntries(['passed','unmet','unknown'].map(status=>[status,assessments.filter(a=>a.status===status).length]));
 return {version:TRADE_SETUP_11_VERSION,status:counts.unknown?'unknown':'ready',counts,assessments,
  setups:assessments.filter(a=>a.status==='passed').map(a=>({...a.setup,...(a.evaluatedSetupProjection?{evaluatedSetupProjection:a.evaluatedSetupProjection}:{}),trendEvaluationVersion:TRADE_SETUP_11_VERSION,
   ...(a.trendEvidence.sourceProfile?{trendEvaluationSourceProfile:a.trendEvidence.sourceProfile}:{}),trendEvidence:a.trendEvidence}))};
}
