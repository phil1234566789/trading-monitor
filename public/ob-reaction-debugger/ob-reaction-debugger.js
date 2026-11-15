(function(root){
 function closedCandles(rows,asOf,seconds){return rows.filter(c=>c.time+seconds<=asOf);}
 function stepAt(index,steps){return steps[Math.max(0,Math.min(steps.length-1,index))];}
 function entryABlocked(entry,asOf){return Number.isFinite(entry?.aUnsuitableAt)&&entry.aUnsuitableAt<=asOf&&(!Number.isFinite(entry.aUnsuitableUntil)||asOf<entry.aUnsuitableUntil);}
 function evaluateOrderBlockReaction(evidence,asOf){
  const trace=[['touchAt','M5-OB berührt'],['oldFvgFilledAt','Alte FVG gefüllt'],['internalObReactionAt','Interner M1-OB reagiert'],['newFvgKnownAt','Neue gleichgerichtete M1-FVG bekannt']].map(([key,label])=>({key,label,available:Number.isFinite(evidence[key])&&evidence[key]<=asOf}));
  const has=t=>Number.isFinite(t)&&t<=asOf;
  const contactAt=evidence.reactionContactAt??evidence.touchAt;
  const reaction=has(contactAt)&&has(evidence.newFvgKnownAt)&&evidence.newFvgKnownAt>=contactAt;
  const entry=evidence.entryContext??{},b=entry.b;
  const deep=b&&has(b.fullFillAt)?b.tests?.find(t=>has(t.knownAt)&&t.knownAt>=b.fullFillAt&&(!Number.isFinite(b.confirmedAt)||t.knownAt<=b.confirmedAt)&&t.depth>(b.maxDepth??.5)):null;
  const rejected=has(evidence.rejectedAt)||Boolean(deep);
  if(entryABlocked(entry,asOf))trace.push({key:'entryA',label:'Entry a ungeeignet: '+entry.aReason,available:true});
  if(b&&has(b.fullFillAt))trace.push({key:'entryB',label:deep?'Entry b: M1-OB nach voller FVG-Füllung über 50 % getestet':'Entry b: volle FVG-Füllung bekannt; M1-OB-Prüfung getrennt',available:true});
  const state=rejected?'false':reaction?'true':'unknown';
  return {entryARejectedAt:has(entry.aUnsuitableAt)&&entryABlocked(entry,entry.aUnsuitableAt)?entry.aUnsuitableAt:null,state,node:rejected?'false':reaction?'confirmed':has(contactAt)?'waiting':'beforeTouch',trace,entryA:entryABlocked(entry,asOf)?'ungeeignet laut Nutzer':'offen',entryB:deep?'abgelehnt':b&&has(b.fullFillAt)?'prüfen':'offen',reason:deep?'Entry b verworfen: bekannte M1-OB-Einstichtiefe > 50 % nach voller FVG-Füllung. Frühere Reaktion bleibt historisch bestehen.':has(evidence.rejectedAt)?evidence.rejectedReason:reaction?'Neue gleichgerichtete M1-FVG nach dem Touch bekannt. Reaktion im verfeinerten Arbeitsmodell bestätigt; Entry-Eignung separat.':'Noch keine bestätigte neue gleichgerichtete M1-FVG. Unbekannt; keine Reaktion aus Schlusskursanzahl erraten.'};
 }
 const api={entryABlocked,evaluateOrderBlockReaction,stepAt,closedCandles};
 if(typeof module!=='undefined')module.exports=api;root.OBReactionDebugger=api;
})(globalThis);
