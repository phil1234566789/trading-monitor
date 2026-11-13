export const SOURCE_IDEA_BINDING_VERSION='known-poi-target-alias-retest-binding-v2';
const target=level=>level?Object.fromEntries(['id','price','knownAt','selectedAt','sourceTime','pivotTime','timeframe','source']
 .filter(key=>level[key]!=null).map(key=>[key,level[key]])):null;
const lifecycleSelection=selection=>({status:selection.status,selectedAt:selection.selectedAt,direction:selection.direction,
 instrument:selection.instrument,target1:target(selection.target1),target2:target(selection.target2)});

// Eine spätere Aliasquelle darf die bereits bekannte POI→Target-Idee nicht neu beginnen lassen.
export function bindKnownSourceIdeas(candidates,asOf,state,signature){
 if(!Number.isFinite(asOf)||!(state instanceof Map)||typeof signature!=='function')throw new Error('Causal idea binding requires explicit time, state and signature');
 const ordered=candidates.filter(c=>Number.isFinite(c.recognizedAt)&&c.recognizedAt<=asOf)
  .slice().sort((a,b)=>Math.max(a.recognizedAt,a.targetSelection?.selectedAt??Infinity)-Math.max(b.recognizedAt,b.targetSelection?.selectedAt??Infinity));
 const resolved=new Map();
 for(const candidate of ordered){
  const key=signature(candidate,asOf);if(!key)continue;
  const knownAt=Math.max(candidate.recognizedAt,candidate.targetSelection.selectedAt);
  let binding=state.get(key);
  if(binding&&(binding.version!==SOURCE_IDEA_BINDING_VERSION||knownAt<binding.knownAt)){
   resolved.set(candidate,{...candidate,ideaBinding:{status:'ambiguous',reason:'earlier-or-incompatible-provenance-after-binding'}});continue;
  }
  if(!binding){
   binding={version:SOURCE_IDEA_BINDING_VERSION,key,familyKey:candidate.sourceFamilyKey,knownAt,canonicalSourceKey:candidate.id,
    selection:structuredClone(lifecycleSelection(candidate.targetSelection)),invalidation:candidate.invalidation,
    retestSource:structuredClone(Object.fromEntries(['sourceKind','sourceRetest','reactionOB','direction']
      .filter(key=>candidate[key]!=null).map(key=>[key,candidate[key]])))};
   state.set(key,binding);
  }
  resolved.set(candidate,{...candidate,ideaKey:key,ideaBinding:{...binding,status:'known'}});
 }
 return candidates.map(c=>resolved.get(c)??c);
}
