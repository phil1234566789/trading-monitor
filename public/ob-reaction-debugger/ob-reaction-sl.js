(function(root){
 const {candleTouchesOrderBlock}=typeof module!=='undefined'?require('./ob-reaction-rendering.js'):root.OBReactionRendering;
 function evaluateReactionStop(input,asOf){
  if(input.reactionState==='false')return {status:'no-entry',price:null,reason:'Reaktion beziehungsweise Entry-Route abgelehnt: kein Entry und kein SL-Vorschlag.'};
  const at=input.entryKnownAt;if(!Number.isFinite(at)||at>asOf)return {status:'pending',price:null,reason:'Noch kein bekannter beurteilter Entry.'};
  if(input.reactionState!=='true'||input.assignmentKnown===false||!input.coverageKnown||!['long','short'].includes(input.direction))return {status:'unknown',price:null,reason:'Reaktions-, Zuordnungs- oder Datenbeleg fehlt.'};
  const ob=input.orderBlock;if(!Number.isFinite(ob?.top)||!Number.isFinite(ob?.bottom)||ob.top<=ob.bottom)return {status:'unknown',price:null,reason:'M5-Zone nicht belegt.'};
  const candidates=input.internalFvgs.filter(f=>f.direction===input.direction&&f.recognizedAt<=at&&(input.rolePolicy!=='preExistingOnly'||f.role==='preExistingInternal'));
  const inside=candidates.filter(f=>f.bottom>=ob.bottom&&f.top<=ob.top);
  const open=inside.filter(f=>!f.firstFarEdgeReach||f.firstFarEdgeReach.knownAt>at);
  const overlapping=candidates.filter(f=>!inside.includes(f)&&candleTouchesOrderBlock({low:f.bottom,high:f.top},ob)&&(!f.firstFarEdgeReach||f.firstFarEdgeReach.knownAt>at));
  if(!open.length&&overlapping.length)return {status:'unknown',price:null,overlappingFvgs:overlapping,reason:'Offene, nur teilweise überlappende FVG: interne Zuordnung für einen engeren SL ungeklärt.'};
  if(open.length)return {status:'ready',anchor:'m5-edge',price:input.direction==='long'?ob.bottom:ob.top,evaluatedAt:at,openFvgs:open,buffer:null,reason:open.length+' passende interne FVG(s) am Entry noch offen: äußere M5-OB-Kante.'};
  if(input.olderFormationsUnknown)return {status:'unknown',price:null,reason:'Keine bekannte interne FVG offen; ältere Formationen vor dem Archivanfang bleiben unbekannt. Kein engerer SL geraten.'};
  const retest=input.retest;if(!retest||!Number.isFinite(retest.knownAt)||retest.knownAt>at||!Number.isFinite(retest.low)||!Number.isFinite(retest.high))return {status:'unknown',price:null,reason:'Keine offene interne FVG, aber Retestextrem nicht rechtzeitig eindeutig belegt.'};
  return {status:'ready',anchor:'retest-extreme',price:input.direction==='long'?retest.low:retest.high,evaluatedAt:at,openFvgs:[],buffer:null,reason:'Keine passende interne FVG mehr offen: bereits bekanntes Retestextrem. Kein Puffer festgelegt.'};
 }
 const api={evaluateReactionStop};if(typeof module!=='undefined')module.exports=api;root.OBReactionStop=api;
})(globalThis);
