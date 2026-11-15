(function(root){
 const helpers=typeof module!=='undefined'?require('./ob-reaction-rendering.js'):root.OBReactionRendering;
 function measureReactionContact(zone,candle,threshold=.10){
  const m=helpers.measureOrderBlockPenetration(zone,zone?.dir===1?'long':'short',[candle]);
  if(![-1,1].includes(zone?.dir)||m.status!=='ready'||!Number.isFinite(threshold)||threshold<0)return{status:'unknown',distance:null,ratio:null};
  if(helpers.candleTouchesOrderBlock(candle,zone))return{status:'touch',distance:0,ratio:0};
  const approach=zone.dir===1?candle.low>zone.top:candle.high<zone.bottom;
  if(!approach)return{status:'none',distance:null,ratio:null};
  const ratio=-m.maxPenetrationFraction,distance=ratio*(zone.top-zone.bottom);
  // Wie qualifiedFvgRetest: Rundungsfehler großer Preise, kein fachlicher Preis-Puffer.
  const rounding=Number.EPSILON*Math.max(Math.abs(zone.top),Math.abs(zone.bottom),1)*8;
  return{status:distance<=threshold*(zone.top-zone.bottom)+rounding?'nearTouch':'none',distance,ratio};
 }
 function scanReactionContacts(zone,candles,asOf,threshold=.10){
  let first=null,exact=null,lastNear=null;
  if(!Number.isFinite(zone?.recognizedAt)||!Number.isFinite(asOf))return{first,exact,lastNear,status:'unknown'};
  for(const candle of candles){if(candle.ignored||candle.time<zone.recognizedAt||candle.time+60>asOf)continue;
   const m=measureReactionContact(zone,candle,threshold),event={...m,candleTime:candle.time,knownAt:candle.time+60};
   if(m.status==='nearTouch')lastNear=event;
   if(!first&&['touch','nearTouch'].includes(m.status))first=event;if(!exact&&m.status==='touch')exact=event;
  }
  return{first,exact,lastNear,status:exact?'touch':first?.status??'none'};
 }
 const api={measureReactionContact,scanReactionContacts};if(typeof module!=='undefined')module.exports=api;root.OBReactionContact=api;
})(globalThis);
