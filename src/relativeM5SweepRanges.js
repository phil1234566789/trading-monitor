import {collectNestedChain} from './marketStructureAnalysis';

export const RELATIVE_M5_SWEEP_RANGE_VERSION='sweep-owned-relative-m5-v1';
const samePivot=(a,b)=>Number.isFinite(a?.pivotTime)&&a.pivotTime===b?.pivotTime
  &&Number.isFinite(a.price)&&Math.abs(a.price-b.price)<1e-9;

export function relativeM5SweepKnownAt(source) {
  const level=source?.ls,fine=level?.fineTouchedTime;
  const timeframe=(source?.sweeps?.[0]?.timeframe ?? '5M').toUpperCase();
  if(level?.touched!==true||(!Number.isFinite(fine)&&timeframe!=='5M'))return null;
  const time=Number.isFinite(fine)?fine:level?.touchedTime;
  return Number.isFinite(time)&&Number.isFinite(level.recognizedAt)&&level.recognizedAt<=time+300?time+300:null;
}

export function selectRelativeM5SweepRanges({source,state,reaction,stateKnownAt,evaluatedAt}) {
  const unknown=reason=>({version:RELATIVE_M5_SWEEP_RANGE_VERSION,status:'unknown',reason,outer:null,inner:null});
  const level=source?.ls,sourceAt=source?.recognizedAt,sweepKnownAt=relativeM5SweepKnownAt(source);
  if(!state||!Number.isFinite(sourceAt)||!Number.isFinite(evaluatedAt)||!Number.isFinite(sweepKnownAt)
    ||stateKnownAt!==sweepKnownAt||sweepKnownAt>sourceAt||sourceAt>evaluatedAt
    ||![1,-1].includes(level?.dir)||!Number.isFinite(level.touchedTime)
    ||(level.fineTouchedTime ?? level.touchedTime)+300>sourceAt)return unknown('sourceContextUnknown');
  const chain=collectNestedChain(state),last=chain.at(-1),up=level.dir===1;
  const incomingTrend=up?'uptrend':'downtrend',originSide=up?'low':'high';
  let incoming=last,depth=chain.length-1,basis='confirmedNestedRange',knownAt=stateKnownAt,confirmation=null;
  if(last.trend!==incomingTrend){
    const candidate=last.nestedTrend,seed=candidate?.appliedPivots?.[1],origin=candidate?.currRange?.[originSide];
    const sweepBar=level.fineTouchedTime ?? level.touchedTime;
    const signals=(reaction?.levels ?? []).filter(fact=>fact.type==='CHoCH'&&fact.direction===(up?'long':'short')
      &&samePivot(fact,level)&&fact.originTime===origin?.pivotTime&&fact.candleTime===sweepBar
      &&Number.isFinite(fact.recognizedAt)&&fact.recognizedAt===fact.candleTime+300&&fact.recognizedAt<=sweepKnownAt);
    if(candidate?.trend!=='unknown'||!samePivot(seed,level)||!samePivot(origin,last.currRange?.[originSide]))
      return unknown('incomingRangeNotAssociated');
    const unique=new Map(signals.map(fact=>[JSON.stringify([fact.originTime,fact.pivotTime,fact.recognizedAt]),fact]));
    if(unique.size!==1)return unknown(unique.size?'ambiguousIncomingReaction':'incomingReactionUnknown');
    confirmation=[...unique.values()][0];incoming=candidate;depth=chain.length;
    basis='existingCloseReactionChoch';knownAt=confirmation.recognizedAt;
  }
  const origin=incoming.currRange?.[originSide];
  if(!origin||origin.pivotTime>=level.touchedTime)return unknown('incomingOriginUnknown');
  if((up?origin.price>=level.price:origin.price<=level.price))return unknown('incomingDirectionNotToSweep');
  // Die nächste tatsächlich pivotbesitzende Vorfahren-Range zählt, nicht eine feste Tiefe.
  const owners=chain.slice(0,depth).map((owner,index)=>({owner,depth:index})).filter(({owner})=>
    ['uptrend','downtrend'].includes(owner.trend)
    &&[...(owner.structurePivots ?? []),...(owner.innerStructurePivots ?? []),owner.currRange?.low,owner.currRange?.high].some(p=>samePivot(p,level))
    &&owner.currRange?.low?.price<=Math.min(origin.price,level.price)
    &&owner.currRange?.high?.price>=Math.max(origin.price,level.price));
  const selected=owners.at(-1);
  if(!selected)return unknown('owningOuterUnknown');
  return {version:RELATIVE_M5_SWEEP_RANGE_VERSION,status:'ready',reason:null,
    outer:{trend:selected.owner.trend,depth:selected.depth,range:selected.owner.currRange,state:selected.owner,knownAt:stateKnownAt},
    inner:{trend:incomingTrend,rawTrend:incoming.trend,depth,range:incoming.currRange,state:incoming,basis,knownAt,confirmation},
    sweep:{price:level.price,pivotTime:level.pivotTime,touchedTime:level.touchedTime}};
}
