// Strukturelle FVG-Bestätigung ist noch kein Entry: die öffentliche Ausgabe wartet auf die getrennten Routen.
export function reactionVerdict(reaction) {
 const {structuralState,reason,knownAt}=reaction;
 if(structuralState==='false'||reason==='marketClosed')return {state:'false',reason,knownAt};
 if(structuralState!=='true')return {state:['noContact','awaitingFvg'].includes(reason)?'pending':'unknown',reason,knownAt};
 const routes=Object.values(reaction.routes??{}),entries=routes.filter(r=>r.status==='entry');
 if(entries.length)return {state:'true',reason:null,knownAt:Math.min(...entries.map(r=>r.entryTime))};
 if(!routes.length||routes.some(r=>r.status==='pending'))return {state:'pending',reason:'entryPending',knownAt:null};
 // unknown steht erst fest, wenn keine Route mehr pending ist; die erste offene Route wäre zu früh (Pin 507 OB1).
 const unresolved=routes.find(r=>r.status==='unknown');
 if(unresolved)return {state:'unknown',reason:unresolved.reason,knownAt:Math.max(...routes.map(r=>r.knownAt??-Infinity))};
 return {state:'false',reason:'entryRoutesRejected',knownAt:Math.max(...routes.map(r=>r.knownAt))};
}
