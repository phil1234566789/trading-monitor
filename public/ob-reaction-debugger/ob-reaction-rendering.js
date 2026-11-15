// Unveränderte Helper-Snapshots aus src/orderBlocks.js:21, orderBlockPenetration.js und orderBlockDetection.js.
(function(root){
function orderBlockEndTime(zone, openEnd = Infinity) {
  return zone.touchedTime ?? (zone.touched || zone.invalidated ? zone.endTime : openEnd);
}
function orderBlockPenetration(orderBlock,direction,candle){
 if(!['long','short'].includes(direction)||![orderBlock?.top,orderBlock?.bottom,candle?.low,candle?.high].every(Number.isFinite)
  ||orderBlock.top<=orderBlock.bottom||candle.low>candle.high)return null;
 return direction==='long'?orderBlock.top-candle.low:candle.high-orderBlock.bottom;
}

// Ein Messwert ist noch keine Strategiegrenze; auch ein vollständiger Durchstich bleibt messbar.
function measureOrderBlockPenetration(orderBlock,direction,candles){
 const empty={status:'unknown',maxPenetrationFraction:null,extremePrice:null,candleTime:null};
 if(!candles.length)return empty;
 let maximum=-Infinity,extreme=null;
 for(const candle of candles){
  const depth=orderBlockPenetration(orderBlock,direction,candle);
  if(depth==null||candle.ignored)return empty;
  if(depth>maximum){maximum=depth;extreme=candle;}
 }
 return {status:'ready',maxPenetrationFraction:maximum/(orderBlock.top-orderBlock.bottom),
  extremePrice:direction==='long'?extreme.low:extreme.high,candleTime:extreme.time};
}

function candleTouchesOrderBlock(candle, zone) {
  return candle.low <= zone.top && candle.high >= zone.bottom;
}
function candleInvalidatesOrderBlock(candle, zone) {
  return zone.dir === 1 ? candle.low < zone.bottom : candle.high > zone.top;
}
// Alle nativen OB-/FVG-Datensätze liefern firstOverlap; finale Lifecycleflags bleiben unbenutzt.
function zoneEndAt(zone,asOf){const touch=zone.firstOverlap;return Math.min(asOf,orderBlockEndTime(touch&&touch.knownAt<=asOf?{touchedTime:touch.candleTime}:{},asOf));}
const api={orderBlockEndTime,zoneEndAt,measureOrderBlockPenetration,candleTouchesOrderBlock,candleInvalidatesOrderBlock};if(typeof module!=='undefined')module.exports=api;root.OBReactionRendering=api;
})(globalThis);
