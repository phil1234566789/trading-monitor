(function(root){
 function fvgFillLabel(fraction,known=true){if(!known||!Number.isFinite(fraction))return 'Füllstand unbekannt';const filled=Math.max(0,Math.min(100,fraction*100));return (100-filled).toFixed(2)+' % offen · '+filled.toFixed(2)+' % gefüllt';}
 function measureZoneMeter({kind,role='friendly',fraction,known,broken=false,filled=false}){
  if(!known||!Number.isFinite(fraction))return{value:null,label:'Messung unbekannt',tone:'unknown'};
  const depth=fraction*100,clamp=n=>Math.max(0,Math.min(100,n)),p=n=>n.toFixed(2)+' %';
  if(kind==='fvg')return{value:clamp(depth),label:fvgFillLabel(fraction)+(role==='opponent'?(filled?' · Gegner abgebaut':' · Gegner noch offen'):''),tone:'positive'};
  if(role==='opponent')return{value:clamp(depth),label:'Abbau '+p(depth)+(broken?' · Gegner zerstört':' · noch kein strikter Bruch'),tone:'positive'};
  return{value:clamp(100-depth),label:'OB intakt '+p(clamp(100-depth))+' · Einstich '+p(depth)+(broken?' · gebrochen':''),tone:broken?'negative':'positive'};
 }
 function zoneMeter(input){const m=measureZoneMeter(input),words=input.kind==='fvg'?['gefüllt','offen']:input.role==='opponent'?['abgebaut','verbleibend']:['intakt','eingestochen'];return{...m,segments:m.value===null?[]:[{value:m.value,word:words[0],positive:true},{value:100-m.value,word:words[1],positive:false}].filter(s=>s.value>0)};}
 const api={zoneMeter,fvgFillLabel};if(typeof module!=='undefined')module.exports=api;root.OBReactionVisual=api;
})(globalThis);
