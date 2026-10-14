export function liveEntryPriceLevels(entry) {
  return [{price:entry.price,title:'Entry',color:'tradeConfirmation'},
    ...[['wide','Weiter SL'],['narrow','Enger SL']].map(([key,title])=>({price:entry.stops?.[key]?.price,title,color:'tradeInvalidation'})),
    ...(entry.scales?.wide?.targets ?? entry.scales?.narrow?.targets ?? []).map(target=>({price:target.price,title:target.label,color:'tradeTarget'}))]
    .filter(level=>Number.isFinite(level.price));
}
