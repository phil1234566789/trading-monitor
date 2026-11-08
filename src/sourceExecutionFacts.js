import {executionSignature} from './setupSourceIdeaIdentity.js';

export function sourceExecutionKey(snapshot){
 const entry=snapshot?.entry;
 if(!Number.isFinite(entry?.ideaKnownAt)||entry.ideaKnownAt>entry.recognizedAt)return null;
 const sourceAt=snapshot.checklist?.setup?.primary?.recognizedAt??entry.sourceRecognizedAt;
 if(Number.isFinite(sourceAt)&&sourceAt>entry.recognizedAt)return null;
 return executionSignature(entry,entry.ideaKey);
}
function matches(snapshot){
 const entry=snapshot.entry,primary=snapshot.checklist?.setup?.primary;
 return (entry.patternMatches??[{id:entry.id,entryPattern:entry.entryPattern,conditions:entry.conditions}]).map(match=>({...match,
  sourceSetupKey:match.sourceSetupKey??entry.setupKey,sourceKnownAt:match.sourceKnownAt??entry.sourceRecognizedAt??primary?.recognizedAt,
  sourceGateFacts:match.sourceGateFacts??(primary?{sourceId:primary.id,recognizedAt:primary.recognizedAt,
   dealingRange:snapshot.dealingRange,checks:Object.fromEntries(Object.entries(primary.checks??snapshot.checklist?.checks??{})
    .map(([key,value])=>[key,{status:value.status,trend:value.trend,evaluatedAt:value.evaluatedAt}]))}:undefined)}));
}
// Nur identische bekannte Ziel-/Exitpläne teilen eine Ausführung; beide Quellen behalten ihre Patternbelege.
export function mergeSourceExecutionFacts(target,alias){
 const key=sourceExecutionKey(target);if(!key||key!==sourceExecutionKey(alias))return false;
 const facts=[...matches(target),...matches(alias)];
 target.entry.patternMatches=[...new Map(facts.map(m=>[JSON.stringify([m.sourceSetupKey,m.id]),m])).values()];
 target.entry.executionKey=key;
 if(target.m1Check)target.m1Check.entry=target.entry;
 return true;
}
