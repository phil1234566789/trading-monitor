export function orderBlockPenetration(orderBlock,direction,candle){
 if(!['long','short'].includes(direction)||![orderBlock?.top,orderBlock?.bottom,candle?.low,candle?.high].every(Number.isFinite)
  ||orderBlock.top<=orderBlock.bottom||candle.low>candle.high)return null;
 return direction==='long'?orderBlock.top-candle.low:candle.high-orderBlock.bottom;
}

// Ein Messwert ist noch keine Strategiegrenze; auch ein vollständiger Durchstich bleibt messbar.
export function measureOrderBlockPenetration(orderBlock,direction,candles){
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
