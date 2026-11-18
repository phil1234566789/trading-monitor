// DOB-Live-Watcher: jede Minute (pg_cron) checkDobTradeSetup() auf dem Fenster seit der letzten Tagespause, Alarm an Telegram
// („Milky Land Alerts“, TELEGRAM_CHAT_ID). Erkennung und Texte kommen unverändert aus src/, damit Statistik und Alarm gleich rechnen.
import {checkDobTradeSetup,dobDataAsOf,dobLiveWindowInput} from '../../../src/dobTradeSetup.js';
import {markIgnoredCandles,htfObCandles} from '../../../src/sessionOccurrences.js';
import {berlinOffsetMinutes,berlinDateStrFor,formatBerlinTime} from '../../../src/berlinTime.js';
import {insideEntryWindow} from '../../../src/orderBlockReaction.js';
import {dobPoiTypeAlarmRuns,dobStaleAlarm} from '../../../src/dobAlarm.js';
import {dobBlockStats} from '../../../src/dobBlockStats.js';
import {dobWatcherCandidates} from '../../../src/dobWatcherCandidates.js';
import {dobCanonicalRunId} from '../../../src/dobPoiType.js';
import {fetchAllRows} from '../_shared/fetchAllRows.ts';
import {dobGuardrailsFromRow,dobEntryRule} from '../../../src/dobGuardrails.js';
import {createDobCounterDobGate} from '../../../src/dobCounterDob.js';
import {dobAutoPin} from '../../../src/dobAutoPin.js';
import {dobTs11FromRow} from '../../../src/dobLqSweepPoi.js';
import {tradeSetup11RowVerdicts,tradeSetup11M5Start,TRADE_SETUP_11_VERSION} from '../../../src/tradeSetup11Rows.js';
import {secretMatches,sendTelegramText} from '../_shared/setup2Notifications.js';
import {db,env,json,checked,headers} from '../_shared/setup2Http.ts';
import {isWithinTradingWindows,type TradingWindows} from '../_shared/tradingHoursGate.ts';

// Jedes Instrument mit eigener Konfig (dob_guardrails), eigenem Alarmfenster und eigenem Herzschlag (dob_watcher_state); ein Fehler
// bei einem Instrument hält die anderen nicht auf.
const INSTRUMENTS=['XAUUSD','GBPUSD','EURUSD'];
// M1/M5 decken 2 Tage für das Gegen-DOB-Gate (v3) samt Wochenende; H1/H4 für beliebig alte POI-Zonen und den ATR.
// ponytail: HTF jede Minute neu aus der DB (~12 Lesezugriffe); ein Stunden-Cache erst, falls Laufzeit oder Requests stören.
const COUNTS: Record<string,number>={'1m':3000,'5m':600,'1h':6000,'4h':1500};
const BAR_SECONDS: Record<string,number>={'1m':60,'5m':300,'1h':3600,'4h':14400,'1D':86400};
// TS1.1-Trendkontext wie der Chart (tradeSetup11ContextLoader: 300 D1, M5 ab dem D1-Anker, höchstens 15000).
const TS11_D1=300,TS11_MAX_M5=15000;
// ponytail: ein neues TS1.1-Urteil je Tick über alle Instrumente (Edge-CPU-Limit); fehlende gelten bis dahin
// nicht als TS1.1, d. h. ein LQ-Sweep-Alarm kommt höchstens ein paar Minuten später, nie fälschlich.
const TS11_PER_TICK=1;
const offset=(sec:number)=>berlinOffsetMinutes(sec*1000);
// Versand steuert die Alarme-Seite: Schalter alarm_settings.dob_setup (fehlende Zeile = an, wie poi-watcher) und
// trading_schedules.alarm_windows des Instruments (fehlende Zeile = nie senden, wie poi-watcher).
// Erkennung und Protokoll laufen unabhängig davon 02:00–22:00 (Dedup, Statistik).
async function alarmPolicy(client:any,instrument:string){
  const [setting,schedule]=await Promise.all([
    client.from('alarm_settings').select('enabled').eq('key','dob_setup').maybeSingle(),
    client.from('trading_schedules').select('alarm_windows').eq('instrument',instrument).maybeSingle()]);
  const enabled=(checked(setting) as any)?.enabled??true;
  const windows=((checked(schedule) as any)?.alarm_windows??{weekday:[],saturday:[],sunday:[]}) as TradingWindows;
  return {enabled,windows,decide:(at:number)=>!enabled?'alarmDisabled':isWithinTradingWindows(at,windows)?null:'outsideAlarmWindow'};
}

// Cursor über das tatsächlich zuletzt gelieferte Zeitfeld: PostgREST kappt Seiten still bei ~1000 Zeilen (CLAUDE.md).
async function closedCandles(client:any,instrument:string,bar:string,evaluatedAt:number,count=COUNTS[bar]){
  const rows:any[]=[];let cursor=new Date(evaluatedAt*1000).toISOString();
  while(rows.length<count){
    const page=checked(await client.from('fxcm_candles').select('time,open,high,low,close,volume').eq('instrument',instrument).eq('bar',bar)
      .lt('time',cursor).order('time',{ascending:false}).limit(Math.min(1000,count-rows.length))) as any[];
    if(!page.length)break;
    rows.push(...page);cursor=page[page.length-1].time;
  }
  return rows.reverse().map(r=>({time:Date.parse(r.time)/1000,open:Number(r.open),high:Number(r.high),low:Number(r.low),close:Number(r.close),volume:Number(r.volume)}))
    .filter(c=>c.time+BAR_SECONDS[bar]<=evaluatedAt);
}

// Gesperrt (Schalter aus, außerhalb des Fensters oder Sperre aus dob_guardrails): ins Protokoll als suppressed mit Grund,
// nie nachsenden (der Dedup-Schlüssel ist damit verbraucht). guardrail hält die Sperre auch bei gesendeten Warn-Alarmen fest.
async function deliver(client:any,event:any,blockedReason:string|null=null){
  const inserted=checked(await client.from('dob_alarm_events').upsert({id:event.id,instrument:event.instrument,poi_type:event.poiType??'htf_ob',phase:event.phase,setup_id:event.setupId??null,
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

// Statistik der Sperren (⛔-Text) aus dem Referenzlauf: nur neu, wenn die Konfig seit der letzten Rechnung gespeichert wurde oder die
// Zahl einen Tag alt ist (Läufe werden neu gefüllt), sonst die gespeicherte. updated_at bleibt unberührt.
async function blockStatsFor(client:any,instrument:string,row:any,guardrails:any){
  const at=row.blocked_stats_at?Date.parse(row.blocked_stats_at):0;
  if(row.blocked_stats&&at>=Date.parse(row.updated_at)&&Date.now()-at<86400e3)return row.blocked_stats;
  const runId=dobCanonicalRunId(instrument,row.poi_type);
  const rows=await fetchAllRows((from:number,to:number)=>client.from('dob_trade_setups').select('entry_time,outcome,max_r,sl_hit,ambiguous_r,counter_dob_status,poi_zone_age_seconds,features')
    .eq('instrument',instrument).eq('run_id',runId).order('entry_time').order('id').range(from,to));
  const stats={...dobBlockStats(guardrails,rows),runId};
  checked(await client.from('dob_guardrails').update({blocked_stats:stats,blocked_stats_at:new Date().toISOString()}).eq('instrument',instrument).eq('poi_type',row.poi_type));
  return stats;
}

// LQ-Sweep-POI = TS1.1 wie im Chart: trade_setups der letzten 2 Tage (decken jeden DOB des Live-Fensters) durch tradeSetup11RowVerdicts.
// Das Urteil wird je Zeile einmal gerechnet und gespeichert; M5/D1 für den Trendkontext nur laden, wenn eins fehlt (Edge-CPU).
async function ts11Setups(client:any,instrument:string,evaluatedAt:number,h1:any[],sessions:any[],dry:boolean,budget:{left:number}){
  const rows=checked(await client.from('trade_setups').select('*,trade_setup_sweeps(price,pivot_time,touched_time,timeframe,is_primary),ob_zones(top,bottom)')
    .eq('instrument',instrument).gte('ob_start_time',new Date((evaluatedAt-2*86400)*1000).toISOString()).order('ob_start_time').limit(1000)) as any[];
  const cached=rows.length?checked(await client.from('trade_setup_ts11_verdicts').select('trade_setup_id,status').eq('version',TRADE_SETUP_11_VERSION)
    .in('trade_setup_id',rows.map(r=>r.id)).limit(1000)) as any[]:[];
  const status=new Map(cached.map(v=>[Number(v.trade_setup_id),v.status]));
  const pending=rows.filter(r=>!status.has(r.id)),missing=budget.left>0?pending.slice(-budget.left):[];
  budget.left-=missing.length;
  if(missing.length){
    const d1=await closedCandles(client,instrument,'1D',evaluatedAt,TS11_D1),from=tradeSetup11M5Start({rows:missing,h1Candles:h1,d1Candles:d1});
    // Kalendergrenze überschätzt die Barzahl (Wochenenden), lädt also eher etwas mehr als nötig.
    const m5=from==null?[]:await closedCandles(client,instrument,'5m',evaluatedAt,Math.min(TS11_MAX_M5,Math.ceil((evaluatedAt-from)/300)));
    const verdicts=tradeSetup11RowVerdicts({rows:missing,instrument,m5Candles:m5,h1Candles:h1,d1Candles:d1,evaluatedAt,sessionConfigs:sessions});
    // unknown erst nach 1 h endgültig: vorher kann der Kerzenstand bis zur Setup-Erkennung noch fehlen.
    const final=missing.filter(r=>verdicts.get(r.id).status!=='unknown'||Date.parse(r.ob_start_time)/1000+3600<evaluatedAt);
    if(!dry&&final.length)checked(await client.from('trade_setup_ts11_verdicts').upsert(final.map(r=>({trade_setup_id:r.id,version:TRADE_SETUP_11_VERSION,
      status:verdicts.get(r.id).status,reason:verdicts.get(r.id).reason})),{onConflict:'trade_setup_id,version',ignoreDuplicates:true}));
    for(const [id,v] of verdicts)status.set(id,v.status);
  }
  return {setups:rows.filter(r=>status.get(r.id)==='passed').map(dobTs11FromRow),rows:rows.length,evaluated:missing.length,pending:pending.length-missing.length};
}

async function writeState(client:any,instrument:string,state:Record<string,unknown>){
  checked(await client.from('dob_watcher_state').upsert({instrument,last_run_at:new Date().toISOString(),updated_at:new Date().toISOString(),...state}));
}

// dry: rechnet auch außerhalb 02:00–22:00, verschickt nichts und schreibt keinen Herzschlag (Prüfung von Datenpfad und Laufzeit).
async function tickInstrument(client:any,instrument:string,evaluatedAt:number,dry=false,probes:number[]=[],budget={left:TS11_PER_TICK}){
  const started=performance.now();
  // Einziger Guardrail (Q2): kein Entry 22:00–02:00 Berlin, also auch kein Alarm.
  if(!dry&&!insideEntryWindow(evaluatedAt)){await writeState(client,instrument,{evaluated_at:new Date(evaluatedAt*1000).toISOString(),skipped:'outsideEntryWindow',error:null});return {skipped:'outsideEntryWindow'};}
  // Sperr-Konfig je POI-Art jede Minute frisch (Statistikseite speichert direkt). Auch ein gesperrter Monat rechnet und meldet ⛔ (Q23).
  const configRows=checked(await client.from('dob_guardrails').select('poi_type,entry_windows,default_tp_r,blocked_months,min_zone_age_seconds,counter_dob_mode,counter_candles_mode,partial_at_r,partial_pct,partial_be,poi_match_mode,alarm_enabled,updated_at,blocked_stats,blocked_stats_at')
    .eq('instrument',instrument).order('poi_type').limit(10)) as any[];
  const poiTypes=await Promise.all(configRows.map(async row=>{const guardrails=dobGuardrailsFromRow(row);
    return {poiType:row.poi_type,guardrails,blockStats:dry?row.blocked_stats:await blockStatsFor(client,instrument,row,guardrails)};}));
  if(!poiTypes.length){await writeState(client,instrument,{evaluated_at:new Date(evaluatedAt*1000).toISOString(),skipped:'noConfig',error:null});return {skipped:'noConfig'};}
  const sessions=(checked(await client.from('sessions').select('label,from_minutes,to_minutes,days,ignore_liquidity').eq('instrument',instrument).limit(200)) as any[])
    .map(r=>({label:r.label,fromMinutes:r.from_minutes,toMinutes:r.to_minutes,days:r.days,ignoreLiquidity:r.ignore_liquidity??false}));
  const [m1,m5,h1,h4]=await Promise.all(['1m','5m','1h','4h'].map(bar=>closedCandles(client,instrument,bar,evaluatedAt)));
  const mark=(rows:any[])=>markIgnoredCandles(rows,sessions,offset);
  const m1Marked=mark(m1),m5Marked=mark(m5);
  const ts11=poiTypes.some(p=>p.poiType==='lq_sweep')?await ts11Setups(client,instrument,evaluatedAt,h1,sessions,dry,budget):null,tradeSetups=ts11?.setups??[];
  // Erkennung zum Datenstand (letzte M1, Feed-Verzug ≤ 3 min), Herzschlag, Stale-Alarm und Alarmfenster zur Uhrzeit.
  const asOf=dobDataAsOf(m1Marked,evaluatedAt);
  const input={...dobLiveWindowInput({instrument:instrument,evaluatedAt:asOf,m1Candles:m1Marked,m5Candles:m5Marked,
    htfCandles:{'1h':htfObCandles(mark(h1),sessions,offset),'4h':htfObCandles(mark(h4),sessions,offset)}}),
    counterDobGate:createDobCounterDobGate({m5Candles:m5Marked,m1Candles:m1Marked,instrument:instrument}),tradeSetups};
  // Je aktive POI-Art ein Durchlauf mit deren Konfig; Ereignisse tragen ihre POI-Art (eigene IDs, eigene Historie).
  const calcStart=performance.now(),runs:any[]=dobPoiTypeAlarmRuns({poiTypes,input,evaluatedAt:asOf,check:checkDobTradeSetup}),calcMs=Math.round(performance.now()-calcStart);
  const stale=dobStaleAlarm({instrument:instrument,lastM1Time:m1.at(-1)?.time,evaluatedAt});
  const events=[...runs.flatMap(r=>r.events.map((event:any)=>({event,run:r}))),...(stale?[{event:stale,run:null}]:[])];
  const count=(key:'setups'|'rejected')=>runs.reduce((n,r)=>n+r.result[key].length,0);
  const policy=await alarmPolicy(client,instrument),blocked=policy.decide(evaluatedAt);
  if(dry)return {dry:true,evaluatedAt,asOf,alarmEnabled:policy.enabled,alarmWindows:policy.windows,blocked,
    alarmWindowProbes:Object.fromEntries(probes.map(p=>[`${berlinDateStrFor(p)} ${formatBerlinTime(p)}`,policy.decide(p)??'senden'])),runtimeMs:Math.round(performance.now()-started),calcMs,ts11:ts11&&{rows:ts11.rows,evaluated:ts11.evaluated,pending:ts11.pending,passed:ts11.setups.length},bars:{m1:m1.length,m5:m5.length,h1:h1.length,h4:h4.length,
    liveM1:input.m1Candles.length,liveM5:input.m5Candles.length},lastM1:m1.at(-1)?.time??null,
    poiTypes:Object.fromEntries(poiTypes.map(({poiType,guardrails})=>{const r=runs.find(x=>x.poiType===poiType);
      return [poiType,{guardrails,entryRuleNow:dobEntryRule(guardrails,evaluatedAt),setups:r?.result.setups.length??null,rejected:r?.result.rejected.length??null,
        rejectedReasons:r?.result.rejected.reduce((n:any,x:any)=>({...n,[x.reason]:(n[x.reason]??0)+1}),{})??null}];})),
    events:events.map(({event:e})=>({id:e.id,poiType:e.poiType??null,phase:e.phase,guardrail:e.guardrail??null,suppressed:!!e.suppressed}))};
  const delivered=[];
  for(const {event,run} of events){
    // Alarm-Schalter je POI-Art (Konfig alarmEnabled): aus = nur Protokoll, wie eine Sperre.
    const off=run&&run.guardrails?.alarmEnabled===false?'poiTypeAlarmOff':null;
    const d:any=await deliver(client,event,event.suppressed?event.guardrail:off??blocked);
    if(!d)continue;
    delivered.push(d);
    // Erster zugestellter Alarm eines Paars: DOB + POI anpinnen. Ein Pin-Fehler darf den schon versendeten Alarm nicht stören.
    const setup=run&&event.setupId&&[...run.result.setups,...run.result.rejected].find((s:any)=>s.id===event.setupId),pair=setup&&run.result.pairs.get(setup.pairId);
    if(pair&&(d.status==='sent'||d.status==='uncertain')){
      try{d.autoPin=await dobAutoPin(client,{event,setup,pair,evaluatedAt:asOf,m5Candles:m5Marked,m1Candles:m1Marked});}
      catch(error){d.autoPin={error:error instanceof Error?error.message:String(error)};console.error('DOB-Auto-Pin fehlgeschlagen',event.id,d.autoPin.error);}
    }
  }
  await writeState(client,instrument,{evaluated_at:new Date(evaluatedAt*1000).toISOString(),last_m1_time:m1.length?new Date(m1[m1.length-1].time*1000).toISOString():null,
    runtime_ms:Math.round(performance.now()-started),calc_ms:calcMs,setups:count('setups'),rejected:count('rejected'),skipped:null,error:null,
    // Heutige Kandidaten fürs DOB-Watcher-Panel; außerhalb 02–22 Uhr bleibt der letzte Stand stehen.
    candidates:dobWatcherCandidates(runs,asOf,instrument)});
  return {evaluatedAt,calcMs,poiTypes:runs.map(r=>r.poiType),setups:count('setups'),events:events.length,delivered};
}

// Fehler im Lauf: Herzschlag mit Fehler und ein Hinweis je Stunde, statt still zu schweigen.
async function reportError(client:any,instrument:string,error:unknown){
  const message=error instanceof Error?error.message:String(error),now=Math.floor(Date.now()/1000);
  await writeState(client,instrument,{error:message}).catch(()=>{});
  await deliver(client,{id:`dob:error:${instrument}:${berlinDateStrFor(now)}:${formatBerlinTime(Math.floor(now/3600)*3600)}`,instrument,phase:'error',
    signalAt:now,text:`⚠️ DOB-Watcher ${instrument}: Lauf fehlgeschlagen (${message.slice(0,300)}). Alarme können fehlen.`},
    (await alarmPolicy(client,instrument).catch(()=>null))?.decide(now)??null).catch(()=>{});
  return message;
}

// Alle Instrumente nacheinander zur selben Minute; Fehler je Instrument landen in dessen Herzschlag und als Hinweis.
async function tick(client:any,dry=false,probes:number[]=[]){
  const started=performance.now(),evaluatedAt=Math.floor(Date.now()/60000)*60,results:Record<string,unknown>={},budget={left:TS11_PER_TICK};
  for(const instrument of INSTRUMENTS){
    try{results[instrument]=await tickInstrument(client,instrument,evaluatedAt,dry,probes,budget);}
    catch(error){results[instrument]={error:await reportError(client,instrument,error)};}
  }
  return {evaluatedAt,runtimeMs:Math.round(performance.now()-started),instruments:results};
}

Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response(null,{headers});
  const client=db();
  if(request.method==='GET')return json(checked(await client.from('dob_watcher_state').select('*').in('instrument',INSTRUMENTS).order('instrument').limit(10)));
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  const token=request.headers.get('authorization')?.replace(/^Bearer /,'');
  if(!await secretMatches(token,env('SETUP2_WATCH_TOKEN')))return json({error:'Unauthorized'},401);
  const body=await request.json().catch(()=>({}));
  try{
    // Testnachricht: belegt Zustellung an den Kanal, bevor der erste echte Alarm kommt.
    if(body?.test){
      const now=Math.floor(Date.now()/1000);
      return json(await deliver(client,{id:`dob:test:${new Date(now*1000).toISOString()}`,instrument:'XAUUSD',phase:'test',signalAt:now,
        text:`🧪 DOB-Watcher ${INSTRUMENTS.join(', ')}: Testnachricht ${berlinDateStrFor(now)} ${formatBerlinTime(now)}. Ab jetzt kommen Alarme beim OB2-Retest und beim Entry (02:00–22:00).`}));
    }
    return json(await tick(client,Boolean(body?.dry),Array.isArray(body?.probes)?body.probes.filter(Number.isFinite):[]));
  }catch(error){
    return json({error:error instanceof Error?error.message:String(error)},500);
  }
});
