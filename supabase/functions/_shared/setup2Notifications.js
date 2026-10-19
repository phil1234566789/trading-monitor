import {operationalAssessment} from './setup2OperationalHealth.js';
import {watcherFreshness} from './setup2Freshness.js';
import {RANGE_HISTORY_WARNING,isRangeWarning} from './setup2RangeWarnings.js';
export async function secretMatches(actual, expected) {
  if (!expected || typeof actual !== 'string') return false;
  const digest = async value => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  const [a, b] = await Promise.all([digest(actual), digest(expected)]);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

export async function sendPushover(message, title, env, fetcher = fetch) {
  if (!env('PUSHOVER_APP_TOKEN') || !env('PUSHOVER_USER_KEY')) throw new Error('Pushover secrets missing');
  const body = new URLSearchParams({token: env('PUSHOVER_APP_TOKEN'), user: env('PUSHOVER_USER_KEY'), message, title});
  const response = await fetcher('https://api.pushover.net/1/messages.json', {method: 'POST', body, signal: AbortSignal.timeout(15000)});
  const data = await response.json();
  if (!response.ok || data.status !== 1) throw new Error(`Pushover rejected request (HTTP ${response.status})`);
  return {status: 'accepted'};
}

const berlinTime = value => value ? new Intl.DateTimeFormat('de-DE', {timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'medium'}).format(new Date(value)) : 'unbekannt';
export function watcherAction(reason='',source=null) {
 reason=typeof reason==='string'?reason:'';
 if(source==='delivery' || source==='provider' || /Pushover|Provider|Versand/i.test(reason))return 'Pushover-Zugang und den angegebenen Versandfehler prüfen.';
 if(source==='cron' || reason.includes('Unabhängiger Servercheck'))return 'Supabase-Cron setup2-notification-watch prüfen.';
 if(reason.includes('FXCM'))return 'FXCM-Collector auf dem VPS und den angegebenen Feedfehler prüfen.';
 return 'VPS-Dienst setup2-watcher und den angegebenen Auswertungsfehler prüfen.';
}
export function notificationText(event) {
  if(event.kind==='problem' && event.payload?.category==='operational-critical'){
    const payload=event.payload,instruments=payload.affected?.join(', ') || 'Algo-Watcher';
    return `🔴 Du bist dran · Algo-Watcher: ${payload.message}\nBetroffen: ${instruments}\nAls kritisch erkannt: ${berlinTime(payload.openedAt)}\nLetzter Erfolg: ${berlinTime(payload.lastSuccessAt)}\n${payload.action ?? 'Bis zur Entwarnung die Marktbeobachtung selbst übernehmen.'}`.slice(0,1000);
  }
  if (event.kind === 'problem') return `🔴 Du bist dran · T68 · ${event.instrument}: ${event.payload?.message ?? 'Algo-Watcher gestört'}\n${watcherAction(event.payload?.message,event.payload?.source)}\nLetzter Erfolg: ${berlinTime(event.payload?.lastSuccessAt)}`;
  const variants = Object.entries(event.payload?.variants ?? {}).map(([name, value]) => `${value.variant ?? name}: Stop ${value.stopPrice ?? value.stop ?? '–'}, Risiko ${value.riskPips ?? '–'} Pips${Number.isFinite(value.lots)?`, ${value.lots} Lots${Number.isFinite(value.fullLots)?` (Full: ${value.fullLots} Lots; ${value.positionSizeFactor===0.5?'50':'100'} %)`:''}`:''}`).join('\n');
  return `${event.instrument} · Stufe ${event.stage} · ${event.direction ?? ''}\nDR ${event.setup_key} · ${berlinTime(event.signal_at)}\n${event.payload?.message ?? ''}\n${variants}`.slice(0, 1000);
}

export async function validatePushover(env, fetcher = fetch) {
  if (!env('PUSHOVER_APP_TOKEN') || !env('PUSHOVER_USER_KEY')) throw new Error('Pushover secrets missing');
  const response = await fetcher('https://api.pushover.net/1/users/validate.json', {method: 'POST',
    body: new URLSearchParams({token: env('PUSHOVER_APP_TOKEN'), user: env('PUSHOVER_USER_KEY')}), signal: AbortSignal.timeout(15000)});
  const data = await response.json();
  if (!response.ok || data.status !== 1) throw new Error(`Pushover validation rejected (HTTP ${response.status})`);
}

export function healthReport(rows, delivery, now = Date.now(), withinHours = instrument => true, server = {}) {
  const instruments = rows.map(row => {
    const value = row.state ?? {};
    const inHours=withinHours(row.instrument),freshness=watcherFreshness(value,row.enabled,now,inHours);
    const evaluationError=isRangeWarning({kind:'problem',id:`health:${row.instrument}`,payload:{message:value.error}})?null:value.error;
    const stale=freshness.stale,error=evaluationError || freshness.error;
    return {instrument: row.instrument, enabled: row.enabled, updatedAt:row.updated_at ?? null,evaluationError:evaluationError ?? null,lastStep:value.lastStep ?? null, phase: value.phase ?? 'Setup 1 beobachten',
      lastSuccessAt: value.lastSuccessAt ?? null, lastProcessAt: value.lastProcessAt ?? null,
      lastM5Time: value.lastM5Time ?? null, lastM1Time: value.lastM1Time ?? null,
      nextExpectedCheck: value.nextExpectedCheck ?? null, activeRanges: (value.activeRanges ?? []).map(r => ({
        setupKey: r.setupKey, direction: r.direction, structureReady: !!r.structureReady, lastM1Time: r.lastM1Time ?? null
      })), suspendedRanges:(value.suspendedRanges ?? []).map(r=>({setupKey:r.setupKey,direction:r.direction,reason:r.reason ?? RANGE_HISTORY_WARNING})), error, errorSince:value.errorSince ?? null, inHours, stale, evaluatedThrough:value.evaluatedThrough ?? null, marketWatermark:freshness.marketWatermark, marketLagSeconds:freshness.marketLagSeconds};
  });
  const enabled = instruments.filter(r => r.enabled);
  const cronAt=Date.parse(server.watch_checked_at);
  const assessment=operationalAssessment(instruments,delivery,now,server),{state}=assessment;
  for(const instrument of instruments)instrument.actionRequired=assessment.criticalReasons.some(r=>r.instrument===instrument.instrument);
  return {checkedAt:Number.isFinite(cronAt)?new Date(cronAt).toISOString():null,
    validUntil:new Date(Number.isFinite(cronAt)?Math.min(now+90000,cronAt+150000):now).toISOString(),
    criticalAt:Number.isFinite(cronAt)?new Date(cronAt+300000).toISOString():null,
    providerCheckedAt:server.provider_checked_at ?? null,...assessment,
    reason:assessment.reason ?? (state==='off'?'Watcher ausgeschaltet':state==='waiting'?(enabled.some(r=>!r.lastSuccessAt)?'Initialer Abgleich läuft':'Außerhalb der Handelszeiten'):'Algorithmus verarbeitet geschlossene Kerzen'),
    pulse:state==='live' && enabled.some(r=>r.inHours && r.activeRanges.some(dr=>dr.structureReady)),instruments,delivery};
}

export function telegramText(event, reason) {
 if(event.kind==='problem' && event.payload?.category==='operational-critical')return notificationText(event);
 const logUrl = 'https://phil1234566789.github.io/trading-monitor/#/protokoll';
 if (event.kind === 'recovery') return `T68 · Watcher läuft wieder; kein Eingreifen nötig\nStörung gemeldet: ${berlinTime(event.payload.reportedAt)}\nWiederhergestellt: ${berlinTime(event.payload.recoveredAt)}\nIncident: ${event.payload.incidentId}\n${logUrl}`;
 return `T68 · Alarm-Protokoll prüfen: ${event.instrument}, Stufe ${event.stage}, DR ${event.setup_key ?? '–'}\n${reason}\n${logUrl}`;
}
export async function sendTelegram(event, reason, env, fetcher = fetch) {
 if (!env('TELEGRAM_BOT_TOKEN') || !env('TELEGRAM_CHAT_ID')) throw new Error('Telegram secrets missing');
 let response;
 try {
  response = await fetcher(`https://api.telegram.org/bot${env('TELEGRAM_BOT_TOKEN')}/sendMessage`, {
   method:'POST', headers:{'Content-Type':'application/json'},
   body:JSON.stringify({chat_id:env('TELEGRAM_CHAT_ID'),text:telegramText(event,reason)}),
   signal:AbortSignal.timeout(15000)
  });
 } catch { throw new Error('Telegram transport failed (acceptance unknown)'); }
 const body = await response.json();
 if (!response.ok || !body.ok) throw new Error(`Telegram rejected request (HTTP ${response.status})`);
}
