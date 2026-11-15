(function(root){
 function reactionFvgLabel(direction){return 'Neue '+(direction===1||direction==='long'?'bullische':'bärische')+' M1-FVG?';}
 function reactionNodeLabel(id,direction,elements={}){
  const adjective=d=>d===1||d==='long'?'bullische':'bärische',main=adjective(direction),enemy=adjective(-direction);
  return {start:(direction===1?'Long':'Short')+' prüfen',touch:(direction===1?'Bullischer':'Bärischer')+' M5-OB-Touch',fvg:reactionFvgLabel(elements.newDirection??direction),oldFvg:'Interne '+adjective(elements.oldDirection??direction)+' M1-FVG?',internalOb:'Interner '+((elements.obDirection??direction)===1?'bullischer':'bärischer')+' M1-OB?',counter:'☠️ '+enemy+' M1-FVG im Weg?',wait:'a) Noch keine neue '+main+' M1-FVG',reaction:'b) '+main+' M1-FVG bekannt'}[id]??null;
 }
 function reactionGraphState(evidence,asOf,result){
  const has=t=>Number.isFinite(t)&&t<=asOf,touch=has(evidence.reactionContactAt??evidence.touchAt),fvg=has(evidence.newFvgKnownAt),b=evidence.entryContext?.b;
  const nodes={start:'visited',touch:touch?'visited':'unknown',fvg:fvg?'visited':touch?'unknown':'not-visited',wait:fvg?'alternative':touch?'unknown':'not-visited',reaction:fvg?(touch?'visited':'unknown'):'not-visited',entryA:fvg?((result.entryA.startsWith('ungeeignet')||Number.isFinite(result.entryARejectedAt))?'rejected':'unknown'):'not-visited',entryB:fvg?(result.entryB==='abgelehnt'?'rejected':has(b?.confirmedAt)?'visited':'unknown'):'not-visited',result:result.state==='false'?'rejected':result.state==='true'?'visited':'unknown'};
  nodes.counter=fvg?'visited':'not-visited';
  const edges={startTouch:touch?'visited':'unknown',touchFvg:touch?'visited':'not-visited',fvgWait:nodes.wait,fvgReaction:fvg?'visited':'not-visited',reactionA:nodes.entryA,reactionB:nodes.entryB,aResult:nodes.entryA==='rejected'?'rejected':'not-visited',bResult:nodes.entryB==='visited'||nodes.entryB==='rejected'?nodes.entryB:'not-visited',touchReject:result.state==='false'&&result.entryB!=='abgelehnt'?'rejected':'not-visited',reactionResult:result.state==='true'?'visited':'not-visited'};
  edges.reactionCounter=fvg?'visited':'not-visited';
  if(nodes.counter==='visited'&&nodes.entryB!=='rejected')edges.reactionB='visited';
  return {nodes,edges};
 }
 const api={reactionGraphState,reactionFvgLabel,reactionNodeLabel};if(typeof module!=='undefined')module.exports=api;root.OBReactionGraph=api;
})(globalThis);
