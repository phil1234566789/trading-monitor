// DOB-Live-Watcher: jede Minute (pg_cron) checkDobTradeSetup() auf dem Fenster seit der letzten Tagespause, Alarm an Telegram
// („Milky Land Alerts“, TELEGRAM_CHAT_ID). Erkennung und Texte kommen unverändert aus src/, damit Statistik und Alarm gleich rechnen.
import {checkDobTradeSetup,dobLiveWindowInput} from '../../../src/dobTradeSetup.js';
import {markIgnoredCandles,htfObCandles} from '../../../src/sessionOccurrences.js';
import {berlinOffsetMinutes,berlinDateStrFor,formatBerlinTime} from '../../../src/berlinTime.js';
import {insideEntryWindow} from '../../../src/orderBlockReaction.js';
import {dobAlarmEvents,dobStaleAlarm} from '../../../src/dobAlarm.js';
import {dobGuardrailsFromRow,dobMonthBlocked,dobEntryRule} from '../../../src/dobGuardrails.js';
import {createDobCounterDobGate} from '../../../src/dobCounterDob.js';
import {secretMatches,sendTelegramText} from '../_shared/setup2Notifications.js';
import {db,env,json,checked,headers} from '../_shared/setup2Http.ts';
import {isWithinTradingWindows,type TradingWindows} from '../_shared/tradingHoursGate.ts';

const SYMBOL='XAUUSD';
// v3-Gate: true = nur lebende Gegen-DOBs sperren, false = jeder (Messung analysis/dob-setup/counter-dob-gate-xau-2026.json).
const DOB_COUNTER_DOB_LIVE_ONLY=true;
// M1/M5 decken 2 Tage für das Gegen-DOB-Gate (v3) samt Wochenende; H1/H4 für beliebig alte Quell-Zonen und den ATR.
// ponytail: HTF jede Minute neu aus der DB (~12 Lesezugriffe); ein Stunden-Cache erst, falls Laufzeit oder Requests stören.
const COUNTS: Record<string,number>={'1m':3000,'5m':600,'1h':6000,'4h':1500};
const BAR_SECONDS: Record<string,number>={'1m':60,'5m':300,'1h':3600,'4h':14400};
const offset=(sec:number)=>berlinOffsetMinutes(sec*1000);
// Versand steuert die Alarme-Seite: Schalter alarm_settings.dob_setup (fehlende Zeile = an, wie poi-watcher) und
// trading_schedules.alarm_windows von XAUUSD (fehlende Zeile = nie senden, wie poi-watcher). Vorgabe Mo–Fr 09:00–18:00.
// Erkennung und Protokoll laufen unabhängig davon 02:00–22:00 (Dedup, Statistik).
async function alarmPolicy(client:any){
  const [setting,schedule]=await Promise.all([
    client.from('alarm_settings').select('enabled').eq('key','dob_setup').maybeSingle(),
    client.from('trading_schedules').select('alarm_windows').eq('instrument',SYMBOL).maybeSingle()]);
  const enabled=(checked(setting) as any)?.enabled??true;
  const windows=((checked(schedule) as any)?.alarm_windows??{weekday:[],saturday:[],sunday:[]}) as TradingWindows;
  return {enabled,windows,decide:(at:number)=>!enabled?'alarmDisabled':isWithinTradingWindows(at,windows)?null:'outsideAlarmWindow'};
}

// Cursor über das tatsächlich zuletzt gelieferte Zeitfeld: PostgREST kappt Seiten still bei ~1000 Zeilen (CLAUDE.md).
async function closedCandles(client:any,bar:string,evaluatedAt:number){
  const rows:any[]=[];let cursor=new Date(evaluatedAt*1000).toISOString();
  while(rows.length<COUNTS[bar]){
    const page=checked(await client.from('fxcm_candles').select('time,open,high,low,close,volume').eq('instrument',SYMBOL).eq('bar',bar)
      .lt('time',cursor).order('time',{ascending:false}).limit(Math.min(1000,COUNTS[bar]-rows.length))) as any[];
    if(!page.length)break;
    rows.push(...page);cursor=page[page.length-1].time;
  }
  return rows.reverse().map(r=>({time:Date.parse(r.time)/1000,open:Number(r.open),high:Number(r.high),low:Number(r.low),close:Number(r.close),volume:Number(r.volume)}))
    .filter(c=>c.time+BAR_SECONDS[bar]<=evaluatedAt);
}

// Gesperrt (Schalter aus, außerhalb des Fensters oder Sperre aus dob_guardrails): ins Protokoll als suppressed mit Grund,
// nie nachsenden (der Dedup-Schlüssel ist damit verbraucht). guardrail hält die Sperre auch bei gesendeten Warn-Alarmen fest.
async function deliver(client:any,event:any,blockedReason:string|null=null){
  const inserted=checked(await client.from('dob_alarm_events').upsert({id:event.id,instrument:event.instrument,phase:event.phase,setup_id:event.setupId??null,
    direction:event.direction??null,signal_at:new Date(event.signalAt*1000).toISOString(),text:event.text,guardrail:event.guardrail??null,
    ...(blockedReason?{status:'suppressed',error:blockedReason}:{})},{onConflict:'id',ignoreDuplicates:true}).select('id')) as any[];
  if(!inserted.length)return null;
  if(blockedReason)return {id:event.id,status:'suppressed',reason:blockedReason};
  let status='sent',error=null;
  try{await sendTelegramText(event.text,env);}
  catch(failure){
    error=failure instanceof Error?failure.message:'Telegram failed';
    // Ein Transportfehler kann trotzdem zugestellt sein; nie blind doppelt senden.
    status=error.includes('rejected')||error.includes('missing')?'failed':'uncertain';
  }
  checked(await client.from('dob_alarm_events').update({status,error,sent_at:status==='sent'?new Date().toISOString():null}).eq('id',event.id));
  return {id:event.id,status};
}

async function writeState(client:any,state:Record<string,unknown>){
  checked(await client.from('dob_watcher_state').upsert({instrument:SYMBOL,last_run_at:new Date().toISOString(),updated_at:new Date().toISOString(),...state}));
}

// dry: rechnet auch außerhalb 02:00–22:00, verschickt nichts und schreibt keinen Herzschlag (Prüfung von Datenpfad und Laufzeit).
async function tick(client:any,dry=false,probes:number[]=[]){
  const started=performance.now(),evaluatedAt=Math.floor(Date.now()/60000)*60;
  // Einziger Guardrail (Q2): kein Entry 22:00–02:00 Berlin, also auch kein Alarm.
  if(!dry&&!insideEntryWindow(evaluatedAt)){await writeState(client,{evaluated_at:new Date(evaluatedAt*1000).toISOString(),skipped:'outsideEntryWindow',error:null});return {skipped:'outsideEntryWindow'};}
  // Sperr-Konfig jede Minute frisch (Statistikseite speichert direkt); im gesperrten Monat wird gar nicht gerechnet.
  const guardrails=dobGuardrailsFromRow(checked(await client.from('dob_guardrails').select('entry_windows,default_tp_r,blocked_months,min_zone_age_seconds')
    .eq('instrument',SYMBOL).maybeSingle()));
  const monthBlocked=dobMonthBlocked(guardrails,evaluatedAt);
  if(!dry&&monthBlocked){await writeState(client,{evaluated_at:new Date(evaluatedAt*1000).toISOString(),skipped:'blockedMonth',error:null});return {skipped:'blockedMonth'};}
  const sessions=(checked(await client.from('sessions').select('label,from_minutes,to_minutes,days,ignore_liquidity').eq('instrument',SYMBOL).limit(200)) as any[])
    .map(r=>({label:r.label,fromMinutes:r.from_minutes,toMinutes:r.to_minutes,days:r.days,ignoreLiquidity:r.ignore_liquidity??false}));
  const [m1,m5,h1,h4]=await Promise.all(['1m','5m','1h','4h'].map(bar=>closedCandles(client,bar,evaluatedAt)));
  const mark=(rows:any[])=>markIgnoredCandles(rows,sessions,offset);
  const m1Marked=mark(m1),m5Marked=mark(m5);
  const input={...dobLiveWindowInput({instrument:SYMBOL,evaluatedAt,m1Candles:m1Marked,m5Candles:m5Marked,
    htfCandles:{'1h':htfObCandles(mark(h1),sessions,offset),'4h':htfObCandles(mark(h4),sessions,offset)}}),guardrails,
    counterDobGate:createDobCounterDobGate({m5Candles:m5Marked,m1Candles:m1Marked,instrument:SYMBOL},{liveOnly:DOB_COUNTER_DOB_LIVE_ONLY})};
  const calcStart=performance.now(),result=checkDobTradeSetup(input),calcMs=Math.round(performance.now()-calcStart);
  const events=dobAlarmEvents(result,evaluatedAt),stale=dobStaleAlarm({instrument:SYMBOL,lastM1Time:m1.at(-1)?.time,evaluatedAt});
  if(stale)events.push(stale);
  const policy=await alarmPolicy(client),blocked=policy.decide(evaluatedAt);
  if(dry)return {dry:true,evaluatedAt,guardrails,monthBlocked,entryRuleNow:dobEntryRule(guardrails,evaluatedAt),alarmEnabled:policy.enabled,alarmWindows:policy.windows,blocked,
    alarmWindowProbes:Object.fromEntries(probes.map(p=>[`${berlinDateStrFor(p)} ${formatBerlinTime(p)}`,policy.decide(p)??'senden'])),runtimeMs:Math.round(performance.now()-started),calcMs,bars:{m1:m1.length,m5:m5.length,h1:h1.length,h4:h4.length,
    liveM1:input.m1Candles.length,liveM5:input.m5Candles.length},lastM1:m1.at(-1)?.time??null,setups:result.setups.length,rejected:result.rejected.length,
    rejectedReasons:result.rejected.reduce((n:any,r:any)=>({...n,[r.reason]:(n[r.reason]??0)+1}),{}),
    events:events.map(e=>({id:e.id,phase:e.phase,guardrail:e.guardrail??null,suppressed:!!e.suppressed}))};
  const delivered=[];
  for(const event of events){const d=await deliver(client,event,event.suppressed?event.guardrail:blocked);if(d)delivered.push(d);}
  await writeState(client,{evaluated_at:new Date(evaluatedAt*1000).toISOString(),last_m1_time:m1.length?new Date(m1[m1.length-1].time*1000).toISOString():null,
    runtime_ms:Math.round(performance.now()-started),calc_ms:calcMs,setups:result.setups.length,rejected:result.rejected.length,skipped:null,error:null});
  return {evaluatedAt,calcMs,setups:result.setups.length,events:events.length,delivered};
}

// Fehler im Lauf: Herzschlag mit Fehler und ein Hinweis je Stunde, statt still zu schweigen.
async function reportError(client:any,error:unknown){
  const message=error instanceof Error?error.message:String(error),now=Math.floor(Date.now()/1000);
  await writeState(client,{error:message}).catch(()=>{});
  await deliver(client,{id:`dob:error:${SYMBOL}:${berlinDateStrFor(now)}:${formatBerlinTime(Math.floor(now/3600)*3600)}`,instrument:SYMBOL,phase:'error',
    signalAt:now,text:`⚠️ DOB-Watcher ${SYMBOL}: Lauf fehlgeschlagen (${message.slice(0,300)}). Alarme können fehlen.`},
    (await alarmPolicy(client).catch(()=>null))?.decide(now)??null).catch(()=>{});
  return message;
}

Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response(null,{headers});
  const client=db();
  if(request.method==='GET')return json(checked(await client.from('dob_watcher_state').select('*').eq('instrument',SYMBOL).maybeSingle()));
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  const token=request.headers.get('authorization')?.replace(/^Bearer /,'');
  if(!await secretMatches(token,env('SETUP2_WATCH_TOKEN')))return json({error:'Unauthorized'},401);
  const body=await request.json().catch(()=>({}));
  try{
    // Testnachricht: belegt Zustellung an den Kanal, bevor der erste echte Alarm kommt.
    if(body?.test){
      const now=Math.floor(Date.now()/1000);
      return json(await deliver(client,{id:`dob:test:${new Date(now*1000).toISOString()}`,instrument:SYMBOL,phase:'test',signalAt:now,
        text:`🧪 DOB-Watcher ${SYMBOL}: Testnachricht ${berlinDateStrFor(now)} ${formatBerlinTime(now)}. Ab jetzt kommen Alarme beim OB2-Retest und beim Entry (02:00–22:00).`}));
    }
    return json(await tick(client,Boolean(body?.dry),Array.isArray(body?.probes)?body.probes.filter(Number.isFinite):[]));
  }catch(error){
    return json({error:await reportError(client,error)},500);
  }
});
