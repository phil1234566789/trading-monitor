// LQ-Algo: Gehört ein LS (M5-Pivot oder OB-Kante) zu einer Range in Setup-Richtung, und liegt er vor dem Range-Extrem? Die Struktur
// liefert m5StructureContext.js als Eingabe; ob die Preisreaktion am Level gut ist, entscheidet liquiditySweepReaction.js.
import {samePivot,snapshotRange,currentM5StructureRange} from './m5StructureContext.js';
import {TRADE_SETUP_M5_FRACTAL_PERIOD} from './priceChartConstants.js';
import {detectLiquidityLevels} from './liquidityDetection.js';

// Ein LS-Pivot muss älter sein als das Extrem der aktuellen Range, an dem die Bewegung zum Sweep beginnt (Low bei Short, High bei Long),
// auch im Trend: Philip zu P493 „nach meiner Regel ist das kein richtiger LS“ (LS 08:50 nach Low 08:35); P489 fällt damit bewusst weg.
export const rangeOriginTime=(current,expectedTrend)=>(expectedTrend==='downtrend'?current?.low:current?.high)?.pivotTime;
export const pivotBeforeRangeOrigin=(current,expectedTrend,pivotTime)=>{
 const origin=rangeOriginTime(current,expectedTrend);
 return Number.isFinite(origin)&&pivotTime<origin;
};

export function findLiquiditySourceOwner({setup,context,resolveContext,expectedTrend,current}) {
 if(setup.ls.sourceKind==='orderBlock'){
  const source=setup.ls,raw=context.rawCandles??context.candles,index=raw.findIndex(c=>c.time===source.sourceStartTime);
  const origins=new Set(index<0?[]:raw.slice(Math.max(0,index-2),index+1).map(c=>c.time));
  context.sourceLiquidity??=detectLiquidityLevels(context.candles,TRADE_SETUP_M5_FRACTAL_PERIOD);
  const pivots=(setup.dir===1?context.sourceLiquidity.highs:context.sourceLiquidity.lows)
   .filter(p=>p.price===source.price&&origins.has(p.pivotTime));
  // Der OB-Altersanker ist kein Fraktal: nur ein wirklich erkannter Ursprungspivot darf die Range belegen.
  const proofs=pivots.map(level=>findLiquiditySourceOwner({setup:{...setup,ls:level},context,resolveContext,expectedTrend,current}));
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
 // Die Wurzel belegt die LS, wenn die aktuelle Range gegen das Setup läuft und erst nach der LS beginnt, egal ob
 // Close-CHoCH oder bestätigt (Philips Wurzel-Skizze: „short weiter runter traden … ab wurzel bis Low“, Pin 557).
 const origin=(expectedTrend==='downtrend'?current?.low:current?.high)?.pivotTime;
 const counterAfterLevel=!!current&&current.trend!==expectedTrend&&origin>level.pivotTime;
 if((birthDepth>0||counterAfterLevel)&&youngest.trend===expectedTrend&&members(youngest).some(p=>samePivot(p,level)))
  return proof(youngest,birthDepth,birthContext.stateKnownAt,'deepestRangeAtLevelBirth');
 const times=[...context.pivotsOuter.map(p=>knownAt(p,context.periods.outer)),
  ...context.pivotsInner.map(p=>knownAt(p,context.periods.inner)),level.touchedTime]
  .filter(at=>Number.isFinite(at)&&at>=birth&&at<=level.touchedTime);
 const owned=prefix=>{
  if(prefix.status!=='ready')return null;
  for(let depth=prefix.chain.length-1;depth>0;depth--){
   const state=prefix.chain[depth];
   if(state.trend!==expectedTrend)continue;
   const boundary=[state.currRange.low,state.currRange.high].some(p=>samePivot(p,level));
   const protectedPoint=state.structurePivots.some(p=>samePivot(p,level)&&p.type===
    (expectedTrend==='uptrend'?'protected-low':'protected-high'));
   if(boundary||protectedPoint)return proof(state,depth,prefix.stateKnownAt,boundary?'rangeBoundaryBeforeSweep':'protectedPivotBeforeSweep');
  }
  return null;
 };
 // chainAt spart je Zeitpunkt die volle Faltung; den Beleg liefert der vollständige Kontext (gleiche Kette, Pivots mit Präfix-Touch).
 for(const at of [...new Set(times)].sort((a,b)=>a-b)){
  const hit=resolveContext.chainAt?(owned(resolveContext.chainAt(at))&&owned(resolveContext(at))):owned(resolveContext(at));
  if(hit)return hit;
 }
 return {status:'unmet',reason:'sourceRangeNotAssociated'};
}

// Gültigkeit einer LS-Quelle für ein Setup in Richtung dir (1 = Short): Range in Setup-Richtung (Trend oder Quelle gehört zu einer
// solchen Range) und Pivot vor dem Range-Extrem. setup: {dir, ls}; context zum Bewertungszeitpunkt (m5StructureContext.js).
export function assessLiquiditySourceValidity({setup,context,resolveContext,closeReactionCache}){
 const current=currentM5StructureRange(context,closeReactionCache),expectedTrend=setup.dir===-1?'uptrend':'downtrend';
 if(!current)return {status:'unknown',reason:'innerTrendUnknown'};
 const counterEvidence={currentRange:current,counterOrigin:rangeOriginTime(current,expectedTrend)};
 const withTrend=current.trend===expectedTrend;
 const owner=!withTrend||setup.ls.sourceKind==='orderBlock'?findLiquiditySourceOwner({setup,context,resolveContext,expectedTrend,current}):null;
 const ownerPivot=owner?.pivot?.pivotTime??setup.ls.pivotTime,evidence=owner?{...counterEvidence,sourceOwner:owner}:counterEvidence;
 if((withTrend||owner.status==='ready')&&!pivotBeforeRangeOrigin(current,expectedTrend,ownerPivot))return {status:'unmet',reason:'sourcePivotInCounterMove',evidence};
 if(withTrend)return {status:'passed',reason:'currentTrendDirection',evidence};
 if(owner.status==='ready')return {status:'passed',reason:'sourceRangeDirection',evidence};
 return {status:owner.status==='unknown'?'unknown':'unmet',reason:owner.reason,evidence:{...counterEvidence,sourceOwner:owner}};
}
