import {bindKnownSourceIdeas} from './setupSourceIdeaBindings.js';

export function evaluateSourceIdeaLifecycles(candidates,{evaluatedAt,bindings,signature,outcomes,evaluateLifecycle,progressFor,...input}){
 const bound=bindKnownSourceIdeas(candidates,evaluatedAt,bindings,signature),evaluated=new Map();
 return bound.map(candidate=>{
  if(candidate.ideaBinding?.status==='ambiguous'){
   const main={state:'unknown',reason:'ambiguousSourceIdeaBinding',recognizedAt:evaluatedAt};
   return {...candidate,lifecycle:{...candidate.lifecycle,main,entrySearchAllowed:false},validity:main};
  }
  const key=candidate.ideaKey??candidate.id;
  const aliases=bound.filter(c=>(c.ideaKey??c.id)===key);
  const rows=[...(outcomes.get(key)??[]),...aliases.flatMap(c=>outcomes.get(c.id)??[])];
  const entries=[...new Map(rows.map(e=>[JSON.stringify([e.entryId,e.variant]),e])).values()];
  const binding=candidate.ideaKey?bindings.get(candidate.ideaKey):null;
  const terminal=binding?.finalLifecycle;
  if(!evaluated.has(key))evaluated.set(key,terminal?.main?.state==='ended'&&terminal.main.recognizedAt<=evaluatedAt
   ?{...terminal,evaluatedAt}:evaluateLifecycle({...input,
   selection:candidate.ideaBinding?.selection??candidate.targetSelection,
   invalidation:candidate.invalidation,candidate:binding?.retestSource??candidate,evaluatedAt,
   entries,progress:progressFor?.(key)}));
  let lifecycle=evaluated.get(key);
  if(candidate.ideaKey&&lifecycle.sourceIdeaKey!==candidate.ideaKey){
   lifecycle={...lifecycle,sourceIdeaKey:candidate.ideaKey,sourceIdeaKnownAt:candidate.ideaBinding.knownAt};evaluated.set(key,lifecycle);
  }
  if(binding&&!binding.finalLifecycle&&lifecycle.main.state==='ended'&&Number.isFinite(lifecycle.main.recognizedAt)&&lifecycle.main.recognizedAt<=evaluatedAt)
   binding.finalLifecycle=structuredClone(lifecycle);
  return {...candidate,knownAsOf:evaluatedAt,lifecycle,validity:lifecycle.main};
 });
}
