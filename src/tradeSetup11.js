import {tradeSetup11SourceTimes} from './tradeSetup11Context.js';
import {createTradeSetup11ContextResolver,currentTradeSetup11Range,findTradeSetup11SourceOwner} from './tradeSetup11Ownership.js';
import {createCloseReactionCache} from './m5CloseReactionHistory.js';
import {detectLiquidityLevels} from './liquidityDetection.js';
import {TRADE_SETUP_M5_FRACTAL_PERIOD} from './priceChartConstants.js';

export const TRADE_SETUP_11_VERSION='ts11-causal-inner-trend-source-range-v1';

export function filterTradeSetup11Candidates({setups=[],instrument,m5Candles=[],h1Candles=[],d1Candles=[],
 evaluatedAt,settings={},sessionConfigs=[]}={}) {
 const resolvers=new Map(),assessments=[];
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
  if(!resolvers.has(symbol))resolvers.set(symbol,{resolve:createTradeSetup11ContextResolver({instrument:symbol,m5Candles,h1Candles,d1Candles,settings,sessionConfigs}),
   closeReactionCache:createCloseReactionCache()});
  const {resolve:resolveContext,closeReactionCache}=resolvers.get(symbol),context=resolveContext(times.nativeGeometryKnownAt);
  if(context.status!=='ready'||context.stateKnownAt<times.nativeGeometryKnownAt){finish('unknown',context.reason??'m5ContextTailMissing');continue;}
  evidence.anchor=context.anchor;evidence.stateKnownAt=context.stateKnownAt;
  if(sourceTimeframe==='5M'){
   context.sourceLiquidity??=detectLiquidityLevels(context.candles,TRADE_SETUP_M5_FRACTAL_PERIOD);
   const known=(setup.dir===1?context.sourceLiquidity.highs:context.sourceLiquidity.lows)
    .some(p=>p.pivotTime===setup.ls.pivotTime&&p.price===setup.ls.price&&p.touched&&p.touchedTime===setup.ls.touchedTime);
   if(!known){finish('unknown','sourceLiquidityNotConfirmed');continue;}
  }
  const current=currentTradeSetup11Range(context,closeReactionCache),expectedTrend=setup.dir===-1?'uptrend':'downtrend';
  if(!current){finish('unknown','innerTrendUnknown');continue;}
  if(current.trend===expectedTrend){finish('passed','currentTrendDirection',{currentRange:current});continue;}
  const owner=findTradeSetup11SourceOwner({setup,context,resolveContext,expectedTrend});
  if(owner.status==='ready')finish('passed','sourceRangeDirection',{currentRange:current,sourceOwner:owner});
  else finish(owner.status==='unknown'?'unknown':'unmet',owner.reason,{currentRange:current,sourceOwner:owner});
 }
 const counts=Object.fromEntries(['passed','unmet','unknown'].map(status=>[status,assessments.filter(a=>a.status===status).length]));
 return {version:TRADE_SETUP_11_VERSION,status:counts.unknown?'unknown':'ready',counts,assessments,
  setups:assessments.filter(a=>a.status==='passed').map(a=>({...a.setup,trendEvaluationVersion:TRADE_SETUP_11_VERSION,trendEvidence:a.trendEvidence}))};
}
