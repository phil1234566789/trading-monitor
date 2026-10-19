// Der belegte Kaltstart brauchte 264 Sekunden; fünf Minuten Planüberzug erlauben dessen Retry.
// Eigene Marktgrenzen verhindern, dass Prozess-Pings oder verschobene Termine einen Stillstand verdecken.
// Strenge Frische bleibt sichtbar; erst ein ausgeschöpfter Wiederanlaufspielraum erfordert Eingreifen.
export const OPERATIONAL_GRACE_MS=300000;
export const M1_CRITICAL_LAG_MS=420000;
export const M5_CRITICAL_LAG_MS=900000;
const date=value=>Date.parse(value);
const age=(value,now)=>Number.isFinite(date(value))?now-date(value):Infinity;
export const credentialsBlocked=reason=>typeof reason==='string' && /HTTP (401|403)\b|credentials missing|secrets missing|Pushover validation rejected \(HTTP 400\)/.test(reason);

export function operationalAssessment(instruments,delivery,now,server) {
 const enabled=instruments.filter(row=>row.enabled),criticalReasons=[];
 for(const row of enabled){
  const limit=row.activeRanges.length?M1_CRITICAL_LAG_MS:M5_CRITICAL_LAG_MS;
  const due=date(row.nextExpectedCheck),initial=date(row.updatedAt);
  const stopped=Number.isFinite(due)?now>due+OPERATIONAL_GRACE_MS:Number.isFinite(initial)&&now>initial+OPERATIONAL_GRACE_MS;
  const frozen=row.inHours && !!row.lastSuccessAt && (age(row.marketWatermark,now)>limit || age(row.lastSuccessAt,now)>limit);
  if(credentialsBlocked(row.evaluationError) || stopped || frozen)criticalReasons.push({source:'runner',instrument:row.instrument,
   reason:row.evaluationError || row.error || 'Marktbeobachtung liefert keinen aktuellen Auswertungsstand',
   lastSuccessAt:row.lastSuccessAt,marketWatermark:row.marketWatermark,credentialsBlocked:credentialsBlocked(row.evaluationError)});
 }
 const cronAge=age(server.watch_checked_at,now),providerAge=age(server.provider_checked_at,now);
 const providerError=server.provider_error;
 const providerErrorAge=age(server.provider_error_since ?? server.provider_checked_at,now);
 if(cronAge>OPERATIONAL_GRACE_MS && !server.checkingNow)criticalReasons.push({source:'cron',reason:'Unabhängige Alarmprüfung ist ausgefallen'});
 if(providerAge>600000 || credentialsBlocked(providerError) || providerError && providerErrorAge>OPERATIONAL_GRACE_MS)
  criticalReasons.push({source:'provider',reason:providerError || 'Pushover-Zustellung kann nicht zuverlässig geprüft werden',credentialsBlocked:credentialsBlocked(providerError)});
 const recentDeliveryIssue=!!delivery.error && (!delivery.issueAt || age(delivery.issueAt,now)<=OPERATIONAL_GRACE_MS);
 const unresolvedDeliveryAuth=credentialsBlocked(delivery.error) && (providerError || Number.isFinite(date(delivery.issueAt)) && date(server.provider_checked_at)<=date(delivery.issueAt));
 if(unresolvedDeliveryAuth || delivery.consecutiveFailures>=2 && (!credentialsBlocked(delivery.error) || unresolvedDeliveryAuth) && age(delivery.firstIssueAt,now)>OPERATIONAL_GRACE_MS && age(delivery.issueAt,now)<600000)
  criticalReasons.push({source:'delivery',reason:'Alarmzustellung wiederholt fehlgeschlagen',credentialsBlocked:credentialsBlocked(delivery.error)});
 const warning=enabled.some(row=>row.error) || recentDeliveryIssue || cronAge>150000 || providerAge>420000 || !!providerError;
 const critical=enabled.length>0 && criticalReasons.length>0;
 const state=!enabled.length?'off':critical?'error':warning?'warning':enabled.some(row=>!row.lastSuccessAt)?'waiting':enabled.some(row=>row.inHours)?'live':'waiting';
 const action=critical?(criticalReasons.some(r=>r.credentialsBlocked)?criticalReasons.find(r=>r.credentialsBlocked)?.source==='runner'?'Den Supabase-Zugang des Watchers korrigieren lassen.':'Die Pushover-Zugangsdaten korrigieren lassen.':'Bis zur Entwarnung die Marktbeobachtung selbst übernehmen; Watcher-Signale sind nicht verlässlich.'):null;
 return {state,actionRequired:critical,action,criticalReasons:critical?criticalReasons:[],
  recoveryReady:enabled.length>0 && !critical && !providerError && !recentDeliveryIssue && cronAge<=150000 && providerAge<=420000
   && enabled.every(row=>!row.evaluationError && age(row.lastSuccessAt,now)<(row.activeRanges.length?120000:420000)),
  reason:critical?(criticalReasons.some(r=>r.source==='runner')?`Marktbeobachtung für ${criticalReasons.filter(r=>r.source==='runner').map(r=>r.instrument).join(', ')} ist nicht verlässlich`:'Alarmzustellung oder unabhängige Alarmprüfung ist nicht verlässlich'):state==='warning'?'Verzögerung oder Wiederholungsversuch · Frische und Protokoll beachten':null};
}
