import {buildHistoricalDailyAnchors} from './tradeSetup2Anchors.js';
import {computeRangesPivots,buildMarketStructureState,collectNestedChain} from './marketStructureAnalysis';
import {closedChecklistCandles} from './tradeSetupChecklistTimeBasis.js';
import {markIgnoredCandles} from './sessionOccurrences.js';
import {berlinOffsetMinutes} from './berlinTime.js';
import {setup1RecognitionTime} from './setup1RecognitionTime.js';

export const TRADE_SETUP_11_CONTEXT_VERSION='causal-d1-rooted-m5-evidence-v1';

export function tradeSetup11SourceTimes(setup) {
 const ob=setup?.obStartTime;
 const nativeGeometryKnownAt=Number.isSafeInteger(ob)&&ob>0&&ob%300===0?ob+600:null;
 const storedFirstSeenAt=Number.isFinite(setup?.createdAt)?setup.createdAt:null;
 const unknown=reason=>({status:'unknown',reason,nativeGeometryKnownAt,storedFirstSeenAt,sourceKnownAt:null});
 if(nativeGeometryKnownAt===null)return unknown('invalidSetupTime');
 if(setup.fromDb&&storedFirstSeenAt===null)return unknown('storedFirstSeenUnknown');
 try {
  const sourceKnownAt=storedFirstSeenAt===null?nativeGeometryKnownAt:setup1RecognitionTime(setup);
  return {status:'ready',reason:null,nativeGeometryKnownAt,storedFirstSeenAt,sourceKnownAt};
 } catch {return unknown('invalidStoredFirstSeen');}
}

export function prepareTradeSetup11Context({instrument,m5Candles=[],h1Candles=[],d1Candles=[],settings={},sessionConfigs=[],evaluatedAt}={}) {
 const base={version:TRADE_SETUP_11_CONTEXT_VERSION,evaluatedAt,stateKnownAt:null,anchor:null,state:null,chain:[]};
 const unknown=reason=>({...base,status:'unknown',reason});
 if(!instrument||!Number.isFinite(evaluatedAt)||evaluatedAt<=0)return unknown('invalidContext');
 const outerPeriod=settings.m5StructurePeriod??5,innerPeriod=settings.m5Structure2Period??2;
 if(![outerPeriod,innerPeriod].every(p=>Number.isSafeInteger(p)&&p>=1))return unknown('invalidStructurePeriods');
 const m5=closedChecklistCandles(m5Candles,'5m',evaluatedAt);
 const h1=closedChecklistCandles(h1Candles,'1h',evaluatedAt);
 const daily=closedChecklistCandles(d1Candles,'1D',evaluatedAt);
 if(!m5.length||!h1.length||!daily.length)return unknown('missingNativeContext');
 const anchor=buildHistoricalDailyAnchors(daily,h1).filter(a=>a.knownAt<=evaluatedAt)
  .sort((a,b)=>b.pivotTime-a.pivotTime)[0];
 if(!anchor)return unknown('dailyAnchorUnknown');
 if(m5[0].time>anchor.structureStartTime)return {...unknown('m5AnchorHistoryMissing'),anchor};
 const configs=sessionConfigs.filter(s=>s.instrument===instrument);
 const rawCandles=markIgnoredCandles(m5,configs,s=>berlinOffsetMinutes(s*1000));
 const candles=rawCandles.filter(c=>!c.ignored);
 const outer=computeRangesPivots(candles,outerPeriod,anchor.structureStartTime);
 const inner=computeRangesPivots(candles,innerPeriod,anchor.structureStartTime);
 const state=buildMarketStructureState(outer,inner,outerPeriod,innerPeriod,candles,{barSeconds:300});
 if(!state)return {...unknown('m5StructureUnknown'),anchor};
 // Die Grafik darf Phasen zurückdatieren; dieser Beleg kennt ausschließlich das geschlossene Präfix.
 return {...base,status:'ready',reason:null,anchor,state,chain:collectNestedChain(state),
  stateKnownAt:m5.at(-1).time+300,periods:{outer:outerPeriod,inner:innerPeriod},
  candles,rawCandles,pivotsOuter:outer,pivotsInner:inner};
}
