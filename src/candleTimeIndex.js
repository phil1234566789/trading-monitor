// Geschlossene Archivserien sind zeitlich sortiert; gleiche Zeitwerte bleiben links.
export function candleTimeIndex(candles,time) {
  let lower=0,upper=candles.length;
  while(lower<upper){
    const mid=(lower+upper)>>>1;
    if(candles[mid].time<time)lower=mid+1;else upper=mid;
  }
  return lower;
}
