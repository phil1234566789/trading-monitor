import {RANGE_HISTORY_WARNING} from './setup2RangeWarnings.js';
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
    const next = Date.parse(value.nextExpectedCheck);
    // Collector startet nominal bei Sekunde 12; zwei Minuten decken Upload + einen ausstehenden Scan ab.
    // Gemessene scanDurationMs erweitert die Grenze bei teureren historischen Nachhol-Scans.
    const grace = Math.max(120000, 2 * Number(value.scanDurationMs || 0));
    const stale = row.enabled && (!Number.isFinite(next) || now > next + grace);
    const error = value.error || (stale ? 'Kein erfolgreicher Algorithmusschritt innerhalb der erwarteten Laufzeit' : null);
    const inHours = withinHours(row.instrument);
    return {instrument: row.instrument, enabled: row.enabled, lastStep:value.lastStep ?? null, phase: value.phase ?? 'Setup 1 beobachten',
      lastSuccessAt: value.lastSuccessAt ?? null, lastProcessAt: value.lastProcessAt ?? null,
      lastM5Time: value.lastM5Time ?? null, lastM1Time: value.lastM1Time ?? null,
      nextExpectedCheck: value.nextExpectedCheck ?? null, activeRanges: (value.activeRanges ?? []).map(r => ({
        setupKey: r.setupKey, direction: r.direction, structureReady: !!r.structureReady, lastM1Time: r.lastM1Time ?? null
      })), suspendedRanges:(value.suspendedRanges ?? []).map(r=>({setupKey:r.setupKey,direction:r.direction,reason:r.reason ?? RANGE_HISTORY_WARNING})), error, errorSince:value.errorSince ?? null, inHours, stale};
  });
  const enabled = instruments.filter(r => r.enabled);
  const cronAt = Date.parse(server.watch_checked_at);
  const providerAt = Date.parse(server.provider_checked_at);
  const serverError = !Number.isFinite(cronAt) || now > cronAt + 150000 ? 'Unabhängiger Servercheck fehlt oder ist veraltet' : !Number.isFinite(providerAt) || now > providerAt + 420000 ? 'Pushover-Prüfung fehlt oder ist veraltet' : server.provider_error;
  const operationalReason=enabled.find(r=>r.error)?.error ?? delivery.error ?? serverError;
  const operationalSource=enabled.some(r=>r.error)?'runner':delivery.error?'delivery':!Number.isFinite(cronAt) || now>cronAt+150000?'cron':'provider';
  const state = !enabled.length ? 'off' : enabled.some(r => r.error) || delivery.error || serverError ? 'error' : enabled.some(r => !r.lastSuccessAt) ? 'waiting' : enabled.some(r => r.inHours) ? 'live' : 'waiting';
  return {checkedAt: Number.isFinite(cronAt) ? new Date(cronAt).toISOString() : null, validUntil: new Date(Number.isFinite(cronAt) ? Math.min(now + 90000, cronAt + 150000) : now).toISOString(), providerCheckedAt: server.provider_checked_at ?? null, state,
    actionRequired:state==='error',action:state==='error'?watcherAction(operationalReason,operationalSource):null,
    reason: state === 'error' ? operationalReason : state === 'off' ? 'Watcher ausgeschaltet' : state === 'waiting' ? (enabled.some(r=>!r.lastSuccessAt)?'Initialer Abgleich läuft':'Außerhalb der Handelszeiten') : 'Algorithmus verarbeitet geschlossene Kerzen',
    pulse: state === 'live' && enabled.some(r => r.inHours && r.activeRanges.some(dr => dr.structureReady)), instruments, delivery};
}
