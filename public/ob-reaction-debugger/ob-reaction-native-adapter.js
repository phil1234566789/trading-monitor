(function(root){
 function buildNativeReactionCase({orderBlock,candles,evaluatedAt,instrument='XAUUSD',sourceMode='existingMitigation'},h){
  const rows=h.closedChecklistCandles(candles,'1m',evaluatedAt),direction=orderBlock.dir===1?'long':'short';
  const contact=h.scanReactionContacts(orderBlock,rows,evaluatedAt,.10),first=contact.first;
  const candidates=h.m1FvgEntryCandidates(rows,evaluatedAt,direction);
  const nearFvg=first?candidates.find(f=>f.candleTime>=first.candleTime&&f.recognizedAt>first.knownAt):null;
  const mitigation=h.evaluateOrderBlockMitigation({orderBlock,m1Candles:rows,fromTime:orderBlock.recognizedAt,evaluatedAt});
  const exactFvg=mitigation.fvg?candidates.find(f=>f.candleTime===mitigation.fvg.candleTime&&f.recognizedAt===mitigation.fvg.recognizedAt):null;
  // Referenzepisoden behalten die bestehende Mitigation; Near-Kontakte sind eine getrennte Quellenprojektion.
  const fvg=sourceMode==='firstNear'?nearFvg:exactFvg;
  const broken=rows.find(c=>c.time>=orderBlock.recognizedAt&&!c.ignored&&h.candleInvalidatesOrderBlock(c,orderBlock));
  const evidence={touchAt:contact.exact?.knownAt??null,reactionContactAt:first?.knownAt??null,newFvgKnownAt:fvg?.recognizedAt??null,
   rejectedAt:broken&&(!fvg||broken.time+60<=fvg.recognizedAt)?broken.time+60:null,rejectedReason:'Native M5-Gegenkante vor erster zugeordneter Reaktions-FVG durchbrochen.'};
  const historyThrough=fvg?.recognizedAt??evaluatedAt,expected=Math.max(0,(Math.floor(historyThrough/60)*60-orderBlock.recognizedAt)/60),after=rows.filter(c=>c.time>=orderBlock.recognizedAt&&c.time+60<=historyThrough);
  const firstGap=after.find((c,i)=>c.time!==orderBlock.recognizedAt+i*60||c.ignored),coverageKnown=after.length===expected&&!firstGap;
  if(!coverageKnown)evidence.newFvgKnownAt=null;
  const entries=Object.fromEntries([['a','immediate'],['b','retestReaction']].map(([route,variant])=>[route,fvg?h.m1FvgEntryPrefill({candles:rows,fvg,evaluatedAt,variant}):{status:'unknown',reason:'No existing direction FVG after eligible contact'}]));
  const inventory=candidates.filter(f=>h.candleTouchesOrderBlock({low:f.bottom,high:f.top},orderBlock)).map(f=>{
   const history=rows.filter(c=>c.time>=f.recognizedAt),fill=history.find(c=>direction==='long'?c.low<=f.bottom:c.high>=f.top);
   return{direction,candleTime:f.candleTime,recognizedAt:f.recognizedAt,bottom:f.bottom,top:f.top,firstFullFillKnownAt:fill?fill.time+60:null,
    coverageComplete:history.length===(Math.floor(evaluatedAt/60)*60-f.recognizedAt)/60&&history.every((c,i)=>c.time===f.recognizedAt+i*60&&!c.ignored)};
  });
  const b={fullFillAt:null,confirmedAt:entries.b.entryTime??null,maxDepth:.5,tests:[]};
  if(fvg?.orderBlock){const fill=rows.find(c=>c.time>=fvg.recognizedAt&&(direction==='long'?c.low<=fvg.bottom:c.high>=fvg.top));
   if(fill){b.fullFillAt=fill.time+60;const through=entries.b.status==='ready'?entries.b.entryTime:evaluatedAt;
    b.tests=rows.filter(c=>c.time>=fill.time&&c.time+60<=through).map(c=>({knownAt:c.time+60,depth:h.measureOrderBlockPenetration(fvg.orderBlock,direction,[c]).maxPenetrationFraction}));}}
  const c={main:orderBlock,d:{instrument,candles:{m1:rows}},evidence,nearTouchTolerance:.10,reactionContact:contact};
  const source={source:{fullSavedDayUsed:coverageKnown,olderFormationsUnknown:true},internalFvgInventory:inventory,
   assessments:['a','b'].map(route=>({route,confirmedM5Assignment:Boolean(first)&&coverageKnown,entryCandidate:entries[route].status==='ready'?{
    knownAt:entries[route].entryTime,entryTime:entries[route].entryTime,entryPrice:entries[route].entryPrice}:null,retestEpisode:{status:'unknown'}}))};
  return{c,source,entries,bContext:b,newFvg:fvg,observedM5Break:broken?{candleTime:broken.time,knownAt:broken.time+60,high:broken.high,low:broken.low}:null,sourceSelection:{mode:sourceMode,existingMitigationKnownAt:exactFvg?.recognizedAt??null,firstNearCandidateKnownAt:nearFvg?.recognizedAt??null,different:exactFvg?.recognizedAt!==nearFvg?.recognizedAt},coverage:{status:coverageKnown?'ready':'unknown',through:historyThrough,expected,actual:after.length,firstGapTime:firstGap?.time??null},
   sourceLimits:['No counter-FVG relevance/strength policy inferred from user case annotations.','No generic retest-episode approval invented; existing route adapter retains explicit user evidence only.','Reference source = unchanged existing mitigation helper. First-near source remains a separate projection; generic near-episode selection unresolved.']};
 }
 const api={buildNativeReactionCase};if(typeof module!=='undefined')module.exports=api;root.OBReactionNativeAdapter=api;
})(globalThis);
