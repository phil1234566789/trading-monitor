// Struktur-Algo: kausaler M5-Strukturkontext ab dem D1-Anker und die aktuelle (innerste) Range. Benutzt von der LS-Reaktion und dem
// LQ-Algo (liquiditySourceOwnership.js); beide fragen hier nur, statt Struktur selbst zu bauen.
import {buildHistoricalDailyAnchors} from './tradeSetup2Anchors.js';
import {computeRangesPivots,buildMarketStructureState,collectNestedChain} from './marketStructureAnalysis.ts';
import {closedChecklistCandles} from './tradeSetupChecklistTimeBasis.js';
import {markIgnoredCandles} from './sessionOccurrences.js';
import {berlinOffsetMinutes} from './berlinTime.js';
import {deriveM5CloseReaction} from './m5CloseReaction.js';
import {createM5StructurePrefixChainResolver} from './m5StructurePrefixChain.js';

export const M5_STRUCTURE_CONTEXT_VERSION='causal-d1-rooted-m5-evidence-v1';

export const samePivot=(pivot,level)=>pivot?.pivotTime===level.pivotTime&&pivot.price===level.price;
export const snapshotRange=level=>({trend:level.trend,low:level.currRange.low,high:level.currRange.high});

// structureStartTime: nur Chart-Debugger-Simulation (manueller Strukturstart); ohne ihn gilt der D1-Anker unverändert.
export function prepareM5StructureContext({instrument,m5Candles=[],h1Candles=[],d1Candles=[],settings={},sessionConfigs=[],evaluatedAt,structureStartTime}={}) {
 const base={version:M5_STRUCTURE_CONTEXT_VERSION,evaluatedAt,stateKnownAt:null,anchor:null,state:null,chain:[]};
 const unknown=reason=>({...base,status:'unknown',reason});
 if(!instrument||!Number.isFinite(evaluatedAt)||evaluatedAt<=0)return unknown('invalidContext');
 const outerPeriod=settings.m5StructurePeriod??5,innerPeriod=settings.m5Structure2Period??2;
 if(![outerPeriod,innerPeriod].every(p=>Number.isSafeInteger(p)&&p>=1))return unknown('invalidStructurePeriods');
 const m5=closedChecklistCandles(m5Candles,'5m',evaluatedAt);
 const h1=closedChecklistCandles(h1Candles,'1h',evaluatedAt);
 const daily=closedChecklistCandles(d1Candles,'1D',evaluatedAt);
 if(!m5.length||!h1.length||!daily.length)return unknown('missingNativeContext');
 const d1Anchor=buildHistoricalDailyAnchors(daily,h1).filter(a=>a.knownAt<=evaluatedAt)
  .sort((a,b)=>b.pivotTime-a.pivotTime)[0];
 const anchor=Number.isFinite(structureStartTime)?{...d1Anchor,structureStartTime,manual:true}:d1Anchor;
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

// chainAt: nur Kette/Status je Zeitpunkt, inkrementell (m5StructurePrefixChain.js) für die Pivot-Schleife des LQ-Algo.
export function createM5StructureContextResolver(input) {
 const cache=new Map();
 let chains=null;
 const resolve=at=>{
  const key=Math.floor(at/300)*300;
  if(!cache.has(key)){
   if(cache.size>=128)cache.delete(cache.keys().next().value);
   cache.set(key,prepareM5StructureContext({...input,evaluatedAt:key}));
  }
  return cache.get(key);
 };
 resolve.chainAt=at=>(chains??=createM5StructurePrefixChainResolver(input))(at);
 return resolve;
}

export function currentM5StructureRange(context,closeReactionCache) {
 const last=context.chain.at(-1);
 if(context.chain.length>1)return {...snapshotRange(last),depth:context.chain.length-1,
  basis:'confirmedNestedRange',knownAt:context.stateKnownAt};
 const root=context.state,candidate=root?.nestedTrend;
 if(!candidate)return null;
 const reaction=deriveM5CloseReaction(root,context.pivotsOuter,context.pivotsInner,
  context.periods.outer,context.periods.inner,context.candles,300,closeReactionCache);
 const fact=reaction.choch,seed=candidate.appliedPivots?.[1];
 if(!fact||fact.recognizedAt>context.stateKnownAt||!samePivot(seed,fact))return null;
 // Ohne bestätigte innere Kette kann der bestehende Schlusskurs-Beleg die erste Gegenrange belegen.
 const trend=fact.direction==='long'?'uptrend':'downtrend';
 const origin=root.currRange[root.trend==='uptrend'?'high':'low'];
 if(fact.originTime!==origin.pivotTime)return null;
 return {...snapshotRange(candidate),trend,depth:1,basis:'existingCloseReactionChoch',knownAt:fact.recognizedAt,confirmation:fact};
}
