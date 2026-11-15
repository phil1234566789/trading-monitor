(function(root){
 const internal=typeof module!=='undefined'?require('./ob-reaction-debugger.js'):root.OBReactionDebugger,stops=typeof module!=='undefined'?require('./ob-reaction-sl.js'):root.OBReactionStop;
 function reaction(input,asOf){
  const now=Math.floor(asOf/60)*60,result=internal.evaluateOrderBlockReaction(input.evidence,now),events=[];
  const push=(time,reason,scope)=>{if(Number.isFinite(time))events.push({time,reason,scope});};
  push(input.evidence.rejectedAt,input.evidence.rejectedReason,'ob-episode');
  if(input.route==='a'&&internal.entryABlocked(input.evidence.entryContext,input.entryCandidate?.knownAt??now))push(input.evidence.entryContext?.aUnsuitableAt,input.evidence.entryContext?.aReason,'entry-route-a');
  const b=input.evidence.entryContext?.b;if(input.route==='b'&&b)for(const t of b.tests??[])if(t.knownAt>=b.fullFillAt&&(!Number.isFinite(b.confirmedAt)||t.knownAt<=b.confirmedAt)&&t.depth>(b.maxDepth??.5))push(t.knownAt,'Entry b: M1-OB nach voller FVG-Füllung über 50 % tief.','entry-route-b');
  const reject=events.sort((a,b)=>a.time-b.time)[0],candidate=input.entryCandidate,known=candidate?.knownAt??candidate?.entryTime;
  if(candidate&&Number.isFinite(known)&&known<=now&&(!reject||known<reject.time)){
   const atEntry=internal.evaluateOrderBlockReaction(input.evidence,known),stop=stops.evaluateReactionStop({...input.stopInput,reactionState:atEntry.state,entryKnownAt:known},known);
   const valid=stop.status==='ready'&&Number.isFinite(candidate.entryPrice)&&Number.isFinite(candidate.entryTime)&&(input.stopInput.direction==='long'?stop.price<candidate.entryPrice:stop.price>candidate.entryPrice);
   if(valid)return {status:'entry',userValue:true,route:input.route,eventId:input.episodeId+':'+input.route+':entry:'+known,knownAt:known,entryPrice:candidate.entryPrice,entryTime:candidate.entryTime,stopLoss:stop.price,stop,internalReaction:atEntry.state};
   if(!reject||reject.time>now)return {status:'pending',userValue:'warte',route:input.route,reason:'Entry-Kandidat vorhanden; '+(stop.reason??'Preise nicht vollständig oder nicht plausibel.'),internalReaction:result.state,stop};
  }
  if(reject&&reject.time<=now)return {status:'rejected',userValue:false,route:input.route,eventId:input.episodeId+':'+input.route+':rejected:'+reject.time,knownAt:reject.time,scope:reject.scope,reason:reject.reason,internalReaction:result.state};
  return {status:'pending',userValue:'warte',route:input.route,reason:'Noch kein vollständiger bekannter Entry mit Entrypreis, Entryzeit und SL.',internalReaction:result.state};
 }
 function createReactionRunner(input){let last=-Infinity,event=null;return asOf=>{const now=Math.floor(asOf/60)*60;if(now<last)event=null;last=now;const result=reaction(input,now),isNew=Boolean(result.eventId&&result.eventId!==event);if(result.eventId)event=result.eventId;return {...result,isNew};};}
 const api={reaction,createReactionRunner};if(typeof module!=='undefined')module.exports=api;root.OBReactionAPI=api;
})(globalThis);
