import {prepareTradeSetup11Context} from './tradeSetup11Context.js';
import {TRADE_SETUP_M5_FRACTAL_PERIOD} from './priceChartConstants.js';
import {deriveM5CloseReaction} from './m5CloseReaction.js';
import {detectLiquidityLevels} from './liquidityDetection.js';

const samePivot=(pivot,level)=>pivot?.pivotTime===level.pivotTime&&pivot.price===level.price;
const snapshotRange=level=>({trend:level.trend,low:level.currRange.low,high:level.currRange.high});

export function createTradeSetup11ContextResolver(input) {
 const cache=new Map();
 return at=>{
  const key=Math.floor(at/300)*300;
  if(!cache.has(key)){
   if(cache.size>=128)cache.delete(cache.keys().next().value);
   cache.set(key,prepareTradeSetup11Context({...input,evaluatedAt:key}));
  }
  return cache.get(key);
 };
}

export function currentTradeSetup11Range(context,closeReactionCache) {
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

export function findTradeSetup11SourceOwner({setup,context,resolveContext,expectedTrend}) {
 if(setup.ls.sourceKind==='orderBlock'){
  const source=setup.ls,raw=context.rawCandles??context.candles,index=raw.findIndex(c=>c.time===source.sourceStartTime);
  const origins=new Set(index<0?[]:raw.slice(Math.max(0,index-2),index+1).map(c=>c.time));
  context.sourceLiquidity??=detectLiquidityLevels(context.candles,TRADE_SETUP_M5_FRACTAL_PERIOD);
  const pivots=(setup.dir===1?context.sourceLiquidity.highs:context.sourceLiquidity.lows)
   .filter(p=>p.price===source.price&&origins.has(p.pivotTime));
  // Der OB-Altersanker ist kein Fraktal: nur ein wirklich erkannter Ursprungspivot darf die Range belegen.
  const proofs=pivots.map(level=>findTradeSetup11SourceOwner({setup:{...setup,ls:level},context,resolveContext,expectedTrend}));
  const proof=proofs.find(p=>p.status==='ready');
  if(proof)return {...proof,sourceKind:'orderBlock',sourceStartTime:source.sourceStartTime};
  return proofs.find(p=>p.status==='unknown')??{status:'unmet',reason:'orderBlockSourceRangeNotAssociated'};
 }
 const level=setup.ls,rows=context.candles,indices=new Map(rows.map((c,i)=>[c.time,i]));
 const knownAt=(pivot,period)=>{
  const index=indices.get(pivot.pivotTime);
  return index===undefined?null:rows[index+period]?.time+300;
 };
 const birth=knownAt(level,TRADE_SETUP_M5_FRACTAL_PERIOD);
 if(!Number.isFinite(birth)||birth>level.touchedTime)return {status:'unknown',reason:'sourcePivotHistoryMissing'};
 const birthContext=resolveContext(birth);
 if(birthContext.status!=='ready')return {status:'unknown',reason:birthContext.reason};
 const proof=(state,depth,at,basis)=>({status:'ready',range:snapshotRange(state),depth,knownAt:at,basis,
  pivot:{price:level.price,pivotTime:level.pivotTime}});
 const youngest=birthContext.chain.at(-1),birthDepth=birthContext.chain.length-1;
 const members=state=>[state.currRange.low,state.currRange.high,...state.structurePivots,...state.innerStructurePivots];
 if(birthDepth>0&&youngest.trend===expectedTrend&&members(youngest).some(p=>samePivot(p,level)))
  return proof(youngest,birthDepth,birthContext.stateKnownAt,'deepestRangeAtLevelBirth');
 const times=[...context.pivotsOuter.map(p=>knownAt(p,context.periods.outer)),
  ...context.pivotsInner.map(p=>knownAt(p,context.periods.inner)),level.touchedTime]
  .filter(at=>Number.isFinite(at)&&at>=birth&&at<=level.touchedTime);
 for(const at of [...new Set(times)].sort((a,b)=>a-b)){
  const prefix=resolveContext(at);
  if(prefix.status!=='ready')continue;
  for(let depth=prefix.chain.length-1;depth>0;depth--){
   const state=prefix.chain[depth];
   if(state.trend!==expectedTrend)continue;
   const boundary=[state.currRange.low,state.currRange.high].some(p=>samePivot(p,level));
   const protectedPoint=state.structurePivots.some(p=>samePivot(p,level)&&p.type===
    (expectedTrend==='uptrend'?'protected-low':'protected-high'));
   if(boundary||protectedPoint)return proof(state,depth,prefix.stateKnownAt,boundary?'rangeBoundaryBeforeSweep':'protectedPivotBeforeSweep');
  }
 }
 return {status:'unmet',reason:'sourceRangeNotAssociated'};
}
