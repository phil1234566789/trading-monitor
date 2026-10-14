export const WATCHER_GRACE_MS=120000;
export function watcherFreshness(state,enabled,now,inHours) {
 const next=Date.parse(state.nextExpectedCheck),minutes=(state.activeRanges ?? []).length>0;
 const watermark=minutes?Date.parse(state.evaluatedThrough):Number.isFinite(state.lastM5Time)?(state.lastM5Time+300)*1000:NaN;
 const marketLagSeconds=Number.isFinite(watermark)?Math.max(0,(now-watermark)/1000):null;
 const overdue=enabled && (!Number.isFinite(next) || now>next+WATCHER_GRACE_MS);
 const oldMarket=enabled && inHours && !!state.lastSuccessAt
  && (!Number.isFinite(watermark) || now-watermark>(minutes?120000:420000));
 return {stale:overdue||oldMarket,marketLagSeconds,marketWatermark:Number.isFinite(watermark)?new Date(watermark).toISOString():null,
  error:oldMarket?`Ausgewerteter ${minutes?'M1':'M5'}-Marktstand fehlt oder ist veraltet`:overdue?'Kein erfolgreicher Algorithmusschritt innerhalb der erwarteten Laufzeit':null};
}
