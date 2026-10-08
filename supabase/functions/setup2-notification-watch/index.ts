import { db, env, json, checked, headers } from '../_shared/setup2Http.ts';
import { healthReport, secretMatches, sendPushover, notificationText, validatePushover, sendTelegram } from '../_shared/setup2Notifications.js';
import { isWithinTradingWindows } from '../_shared/tradingHoursGate.ts';

import {recoveryHealthReady} from '../_shared/setup2Recovery.js';
import {rangeWarningEvent,isRangeWarning} from '../_shared/setup2RangeWarnings.js';

async function readHealth(client: any) {
  const [states, schedules, deliveries, server] = await Promise.all([
    client.from('setup2_live_state').select('instrument,enabled,state').limit(3),
    client.from('trading_schedules').select('instrument,trading_windows').limit(10),
    client.from('setup2_notification_outbox').select('status,error,provider_accepted_at,setup2_alarm_events!inner(kind)').neq('setup2_alarm_events.kind','recovery').in('status',['accepted','failed','uncertain']).order('id', {ascending: false}).limit(1),
    client.from('pushover_test_limits').select('watch_checked_at,provider_checked_at,provider_error').eq('id',true).single()
  ]);
  const rows = checked(states) as any[];
  const windows = new Map((checked(schedules) as any[]).map(row => [row.instrument, row.trading_windows]));
  const last = (checked(deliveries) as any[])[0];
  const delivery = {status: last?.status ?? 'none', lastAcceptedAt: last?.provider_accepted_at ?? null,
    error: ['failed','uncertain'].includes(last?.status) ? last.error : null};
  return {report: healthReport(rows, delivery, Date.now(), (instrument: string) => {
    const value = windows.get(instrument);
    return !!value && isWithinTradingWindows(Date.now() / 1000, value);
  }, checked(server)), windows, rows};
}
async function missed(client: any, event: any, reason: string) {
  checked(await client.from('setup2_alarm_events').update({missed_reason: reason}).eq('id', event.id));
  checked(await client.from('setup2_notification_outbox').upsert({event_id: event.id, channel: 'telegram'}, {onConflict: 'event_id,channel', ignoreDuplicates: true}));
}
async function tick(client: any) {
  let server = checked(await client.from('pushover_test_limits').select('provider_checked_at,provider_error').eq('id',true).single()) as any;
  if (!server.provider_checked_at || Date.now()-Date.parse(server.provider_checked_at)>300000) {
    let provider_error = null;
    try { await validatePushover(env); } catch (error) { provider_error = error instanceof Error ? error.message : 'Pushover validation failed'; }
    server = {...server, provider_checked_at: new Date().toISOString(), provider_error};
  }
  checked(await client.from('pushover_test_limits').update({provider_checked_at:server.provider_checked_at,provider_error:server.provider_error}).eq('id',true));
  const {report, windows, rows} = await readHealth(client);
  if (server.provider_error) checked(await client.rpc('setup2_record_problem', {
    p_id: `provider:${new Date().toISOString().slice(0,10)}:${server.provider_error}`,p_instrument:'GBPUSD',
    p_payload:{source:'provider',message:server.provider_error,lastSuccessAt:null}
  }));
  // Fallwarnungen bleiben im Protokoll. Direkter Event-Insert legt ausdrücklich keine Versand-Outbox an.
  for (const row of rows) for (const range of row.state?.suspendedRanges ?? []) {
    checked(await client.from('setup2_alarm_events').upsert(rangeWarningEvent(row.instrument,range), {onConflict:'id',ignoreDuplicates:true}));
  }
  for (const instrument of report.instruments) {
    if (instrument.enabled && instrument.error) {
      checked(await client.rpc('setup2_record_problem', {
        p_id: `health:${instrument.instrument}:${instrument.errorSince ?? 'initial'}:${instrument.error}`,
        p_instrument: instrument.instrument,
        p_payload: {message: instrument.error, lastSuccessAt: instrument.lastSuccessAt}
      }));
    }
  }
  // Abgebrochene Sendungen sind ungewiss; sie werden dokumentiert, niemals blind wiederholt.
  const abandoned = checked(await client.from('setup2_notification_outbox').select('id,event_id,channel')
    .eq('status','claimed').lt('claim_until', new Date().toISOString()).limit(20)) as any[];
  for (const item of abandoned) {
    const event = checked(await client.from('setup2_alarm_events').select('*').eq('id', item.event_id).single()) as any;
    if (item.channel === 'pushover' && event.kind === 'trading') await missed(client, event, 'Versand unterbrochen; Providerannahme unbekannt');
  }
  checked(await client.rpc('setup2_prepare_recovery', {p_healthy:recoveryHealthReady(report)}));
  const items = checked(await client.rpc('setup2_claim_notifications', {p_limit: 2})) as any[];
  const results = [];
  for (const item of items) {
    const event = checked(await client.from('setup2_alarm_events').select('*').eq('id', item.event_id).single()) as any;
    let status = 'accepted'; let error = null; let retry_after = null; let deferred = false;
    try {
      if (isRangeWarning(event)) {
        status='suppressed';
        if (event.payload?.category!=='range-warning') checked(await client.from('setup2_alarm_events').update({payload:{...event.payload,category:'range-warning'}}).eq('id',event.id));
      }
      else if (event.kind === 'recovery') {
        const current = (await readHealth(client)).report;
        const recovery = checked(await client.rpc('setup2_recovery_status', {p_event_id:event.id}));
        if (recovery === 'superseded') status='suppressed';
        else if (recovery !== 'ready' || !recoveryHealthReady(current,event.payload.reportedAt)) {
          status='pending'; deferred=true; retry_after=new Date(Date.now()+60000).toISOString();
        } else await sendTelegram(event, null, env);
      }
      else if (item.channel === 'telegram') await sendTelegram(event, event.missed_reason ?? 'Pushover-Versand gestört', env);
      else if (event.kind === 'trading') {
        const schedule = windows.get(event.instrument);
        const signalInside = schedule && isWithinTradingWindows(Date.parse(event.signal_at) / 1000, schedule);
        const nowInside = schedule && isWithinTradingWindows(Date.now() / 1000, schedule);
        const runner = report.instruments.find((r: any) => r.instrument === event.instrument);
        const currentState = rows.find((r: any) => r.instrument === event.instrument)?.state;
        const olderThanWatermark = currentState?.evaluatedThrough && Date.parse(event.signal_at) < Date.parse(currentState.evaluatedThrough);
        if (event.missed_reason || olderThanWatermark || !signalInside || !nowInside || runner?.error) {
          status = 'suppressed';
          await missed(client, event, event.missed_reason ?? (!signalInside || !nowInside ? 'Außerhalb der Handelszeiten' : 'Watcher-Störung vor Versand'));
        } else await sendPushover(notificationText(event), `Trading Monitor · Stufe ${event.stage}`, env);
      } else await sendPushover(notificationText(event), 'Trading Monitor · Störung', env);
    } catch (failure) {
      error = failure instanceof Error ? failure.message : 'Notification failed';
      // Netz-Timeout ist absichtlich uncertain: genau-einmal garantiert der Provider nicht.
      status = error.includes('rejected') || error.includes('secrets missing') ? 'failed' : 'uncertain';
      if (event.kind === 'recovery' && status === 'failed') retry_after=new Date(Date.now()+60000).toISOString();
      if (item.channel === 'pushover') await missed(client, event, `Pushover fehlgeschlagen: ${error}`);
      if (item.channel === 'pushover') checked(await client.rpc('setup2_record_problem', {
        p_id: `delivery:${new Date().toISOString().slice(0,10)}:${status}`, p_instrument: event.instrument,
        p_payload: {message: `Pushover-Versand ${status}: ${error}`, lastSuccessAt: report.instruments.find((r: any) => r.instrument === event.instrument)?.lastSuccessAt}
      }));
    }
    checked(await client.from('setup2_notification_outbox').update({status, error, retry_after, ...(deferred?{attempts:item.attempts-1}:{}), claim_until: null,
      provider_accepted_at: status === 'accepted' ? new Date().toISOString() : null}).eq('id', item.id));
    results.push({id: item.id, status});
  }
  // Nur ein vollständig erfolgreicher Watch-Durchlauf darf den unabhängigen Heartbeat verlängern.
  checked(await client.from('pushover_test_limits').update({watch_checked_at:new Date().toISOString()}).eq('id',true));
  return {processed: results};
}
Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, {headers});
  try {
    if (request.method === 'GET') return json((await readHealth(db())).report);
    if (request.method !== 'POST') return json({error: 'Method not allowed'}, 405);
    const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
    if (!await secretMatches(token, env('SETUP2_WATCH_TOKEN'))) return json({error: 'Unauthorized'}, 401);
    return json(await tick(db()));
  } catch {
    return json({error: 'Watcher health or notification transaction failed'}, 503);
  }
});
