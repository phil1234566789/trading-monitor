(function(root){
 const helpers=typeof module!=='undefined'?require('./ob-reaction-rendering.js'):root.OBReactionRendering;
 function observeInternalSources(c,asOf){
  const old=c.old,inner=old?(old.orderBlock??c.inner):null,direction=c.main.dir===1?'long':'short';
  const rowsAfter=source=>c.d.candles.m1.filter(row=>row.time>=source.recognizedAt&&row.time+60<=asOf);
  let oldFvg={present:false,known:false},internalOb={present:false,known:false};
  if(old){const known=old.recognizedAt<=asOf,rows=known?rowsAfter(old):[],m=helpers.measureOrderBlockPenetration(old,direction,rows),fraction=m.status==='ready'?Math.max(0,Math.min(1,m.maxPenetrationFraction)):0;oldFvg={present:true,known,bottom:old.bottom,top:old.top,candleTime:old.candleTime,knownAt:old.recognizedAt,fraction,filled:known&&fraction>=1,remaining:(old.top-old.bottom)*(1-fraction)};}
  if(inner){const known=inner.recognizedAt<=asOf,rows=known?rowsAfter(inner):[],touch=rows.find(row=>helpers.candleTouchesOrderBlock(row,inner)),after=touch?rows.filter(row=>row.time>=touch.time):[],m=helpers.measureOrderBlockPenetration(inner,direction,after);internalOb={present:true,known,bottom:inner.bottom,top:inner.top,knownAt:inner.recognizedAt,touched:Boolean(touch),touchKnownAt:touch?touch.time+60:null,held:touch?!after.some(row=>helpers.candleInvalidatesOrderBlock(row,inner)):null,fraction:m.maxPenetrationFraction};}
  return {oldFvg,internalOb};
 }
 function observeOpponentPath(c,asOf){
  if(c.opponentAssessmentMode!=='reaction-window')return null;
  const start=c.evidence.reactionContactAt??c.evidence.touchAt;if(!Number.isFinite(start)||start>asOf)return{status:'unknown',sources:[],active:[]};
  const rows=c.d.candles.m1.filter(r=>r.time>=start-60&&r.time+60<=asOf);if(!rows.length)return{status:'unknown',sources:[],active:[]};
  const path={low:Math.min(...rows.map(r=>r.low)),high:Math.max(...rows.map(r=>r.high))},direction=c.main.dir===1?'short':'long';
  const known=c.d.fvgs.filter(f=>f.direction===direction&&f.recognizedAt<=asOf),sources=known.filter(f=>helpers.candleTouchesOrderBlock(path,f)),active=sources.filter(f=>!f.firstFarEdgeReach||f.firstFarEdgeReach.knownAt>asOf);
  return{status:active.length?'active':'clear',sources,active,path,from:start-60,through:asOf,excluded:known.filter(f=>!sources.includes(f))};
 }
 const api={observeInternalSources,observeOpponentPath};if(typeof module!=='undefined')module.exports=api;root.OBReactionInternal=api;
})(globalThis);
