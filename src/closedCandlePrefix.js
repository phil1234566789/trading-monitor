export function closedCandleEnd(candles,duration,evaluatedAt) {
  let lower=0,upper=candles.length;
  while(lower<upper){
    const mid=(lower+upper)>>>1;
    if(candles[mid].time+duration<=evaluatedAt)lower=mid+1;else upper=mid;
  }
  return lower;
}

// Nur für die unveränderliche, sortierte Archivserie eines Scanner-Aufrufs.
// Rücksprünge bilden einen neuen Präfix; frühere Snapshot-Arrays bleiben erhalten.
export function createClosedCandlePrefix(candles,duration) {
  let count=-1,prefix;
  return evaluatedAt=>{
    const end=closedCandleEnd(candles,duration,evaluatedAt);
    if(end!==count){count=end;prefix=candles.slice(0,end);}
    return prefix;
  };
}
