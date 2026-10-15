import {formatDatedTime} from './berlinTime.js';
import {fmtPrice,pricePrecisionForInstrument} from './format.js';
export function savedLiveEntryFacts(snapshot){
 if(!snapshot?.observationOnly || !snapshot.entry)return [];
 const entry=snapshot.entry,at=snapshot.knownAt,known=time=>Number.isFinite(time)&&time<=at,facts=[];
 if(known(entry.confirmedAt))facts.push(`Bestätigungszeit im Originalentry: ${formatDatedTime(entry.confirmedAt)} · vollständige DR-Stufenprüfung fehlt.`);
 const trend=entry.conditions?.m5Countertrend;
 if(known(trend?.recognizedAt))facts.push(`D · M5-Countertrend im Originalentry: ${trend.trend ?? 'Trendbezeichnung nicht gespeichert'} · erkannt ${formatDatedTime(trend.recognizedAt)}.`);
 for(const [key,label] of [['target1','T1'],['target2','T2']]){
  const target=entry[key] ?? entry.scales?.wide?.targets?.find(target=>target.label===label) ?? entry.scales?.narrow?.targets?.find(target=>target.label===label),price=typeof target==='number'?target:target?.price;
  if(Number.isFinite(price))facts.push(`${label}-Preis im Originalentry: ${fmtPrice(price,pricePrecisionForInstrument(snapshot.instrument))} · Erreichen nicht gespeichert.`);
 }
 return facts;
}
