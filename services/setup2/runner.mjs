import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {scanTradeSetup2Window} from '../../src/tradeSetup2Scan.js';
import {buildHistoricalDailyAnchors} from '../../src/tradeSetup2Anchors.js';
import {setup1RecognitionTime} from '../../src/setup1RecognitionTime.js';
import {tradeSetupFromRow} from '../../src/tradeSetupRow.js';
import {evaluateTradingHours} from '../../src/tradeSetupChecklistTime.js';
import {minuteAlarmEvents,structureReady,deliveryReason} from './events.js';
import {archiveClient} from '../../scripts/tradeSetup2Archive.mjs';

const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url || !key || !process.env.SETUP2_WATCH_TOKEN)throw new Error('Watcher server credentials missing');
const client=archiveClient({url,key}),owner=randomUUID(),memory=new Map();
const iso=sec=>new Date(sec*1000).toISOString();
const seconds=value=>typeof value==='number'?value:Date.parse(value)/1000;
async function request(path,body,method='POST') {
 const response=await fetch(`${url}/rest/v1/${path}`,{method,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
  ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw new Error(`Watcher database ${path.split('?')[0]}: HTTP ${response.status}`);
 const text=await response.text();return text?JSON.parse(text):null;
}
async function candles(instrument,bar,from=0) {
 const rows=await client.pages('fxcm_candles',{instrument:`eq.${instrument}`,bar:`eq.${bar}`,select:'time,open,high,low,close,volume',order:'time.asc',time:`gte.${iso(from)}`});
 return rows.map(c=>({...c,time:seconds(c.time)}));
}
async function updateCandles(cache,instrument,bar,from=0) {
 const rows=cache[bar] ?? [];const added=await candles(instrument,bar,rows.length?rows.at(-1).time+1:from);
 rows.push(...added);cache[bar]=rows;return rows;
}
function sessionRows(rows){return rows.map(r=>({id:r.id,label:r.label,instrument:r.instrument,fromMinutes:r.from_minutes,toMinutes:r.to_minutes,
 highLowRelevant:r.high_low_relevant,ignoreLiquidity:r.ignore_liquidity ?? false,danger:r.danger,days:r.days}));}
async function drain(){
 const response=await fetch(`${url}/functions/v1/setup2-notification-watch`,{method:'POST',headers:{Authorization:`Bearer ${process.env.SETUP2_WATCH_TOKEN}`},signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw new Error(`Notification watch HTTP ${response.status}`);
}
async function instrumentTick(row,sessions,schedules,news) {
 const instrument=row.instrument,started=Date.now(),previous=row.state ?? {};
 const acquired=await request('rpc/setup2_acquire_lease',{p_instrument:instrument,p_owner:owner,p_seconds:900});
 if(!acquired)return;
 let cache=memory.get(instrument),startup=!cache;
 if(!cache){cache={'entries':previous.entries ?? [],ranges:new Map(),structures:new Map(Object.entries(previous.structureKnownAt ?? {}))};memory.set(instrument,cache);}
 try {
  const [daily,h1]=await Promise.all([updateCandles(cache,instrument,'1D'),updateCandles(cache,instrument,'1h')]);
  const anchors=buildHistoricalDailyAnchors(daily,h1),now=Date.now()/1000;
  const latest=anchors.findLast(a=>a.knownAt<=now);
  if(!latest)throw new Error('Kein kausal bekannter D1-P4-Strukturanker');
  const retained=(previous.activeRanges ?? []).map(r=>r.source).filter(Boolean);
  const raw=await client.pages('trade_setups',{instrument:`eq.${instrument}`,source:'eq.live',created_at:`gte.${iso(latest.structureStartTime)}`,select:'*,trade_setup_sweeps(*)',order:'created_at.asc,id.asc'});
  const sources=[...new Map([...retained,...raw.map(tradeSetupFromRow)].map(s=>[s.tradeSetupId,s])).values()];
  const relevant=anchors.filter(a=>sources.some(s=>a===anchors.findLast(p=>p.knownAt<=setup1RecognitionTime(s))));
  const m5Start=Math.min(latest.structureStartTime,...relevant.map(a=>a.structureStartTime));
  if(cache.m5Start!=null && m5Start<cache.m5Start)delete cache['5m'];cache.m5Start=m5Start;
  const m5=await updateCandles(cache,instrument,'5m',m5Start);
  if(!m5.length)throw new Error('Geschlossene M5-Kerzen fehlen');
  let lastM5=m5.at(-1).time;const closedM5=lastM5+300;
  const tradingWindows=schedules.find(s=>s.instrument===instrument)?.trading_windows;
  if(!tradingWindows)throw new Error('Handelszeiten fehlen');
  const lastProcessed=seconds(previous.evaluatedThrough);
  const events=[],ranges=new Map(),entries=new Map(cache.entries.map(s=>[s.entry.id,s]));
  const input={instrument,tradeSetups:sources,m5Candles:m5,h1Candles:h1,dailyAnchors:anchors,sessionConfigs:sessions,tradingWindows,
   news:news.map(n=>({...n,eventTime:seconds(n.event_time)})),newsLoadStatus:'ready',settings:{},yieldControl:()=>Promise.resolve(),
   loadM1Candles:async({structureFromTime})=>{
    // Scanner bestimmt Sweep-/P5-Vorlauf. Preisvergleich braucht die bestätigte OB-Historie ebenfalls.
    const from=Math.min(structureFromTime,...sources.map(s=>s.obStartTime))-131*60;
    if(cache.m1Start!=null && from<cache.m1Start)delete cache['1m'];cache.m1Start=from;
    return updateCandles(cache,instrument,'1m',from);
   },onSnapshot:s=>{if(s.entry)entries.set(s.entry.id,{setupKey:s.setupKey,entry:s.entry});else ranges.set(s.setupKey,s);}};
  const rememberStructure=minute=>{
   const {context,check,knownAt}=minute;
   if(structureReady(check.conditions,context.direction,knownAt) && !cache.structures.has(context.setupKey))cache.structures.set(context.setupKey,knownAt);
  };
  // Nach Neustart rekonstruieren wir die Entry-/Lifecycle-Historie mit dem unveränderten Batchpfad.
  const baselineTo=Number.isFinite(lastProcessed)?Math.min(lastProcessed,closedM5):closedM5;
  if(startup && !previous.initializedAt && sources.length && Math.min(...sources.map(setup1RecognitionTime))<=baselineTo){
   await scanTradeSetup2Window({...input,existingEntries:[],fromTime:Math.min(...sources.map(setup1RecognitionTime)),toTime:baselineTo,onMinuteCheck:rememberStructure});
   cache.entries=[...entries.values()];
  }
  if(startup){await updateCandles(cache,instrument,'5m',m5Start);lastM5=m5.at(-1).time;}
  await updateCandles(cache,instrument,'1m',cache.m1Start ?? closedM5-131*60);
  const latestClosed=cache['1m'].at(-1)?.time+60;
  if(!Number.isFinite(latestClosed))throw new Error('Geschlossene M1-Kerzen fehlen');
  const processed=Number.isFinite(lastProcessed)?lastProcessed:latestClosed-60;
  const fromTime=Math.min(latestClosed,processed+60);
  const onMinuteCheck=minute=>{
   const {context,check,knownAt}=minute;
   const source=sources.find(s=>`${instrument}:setup1:${s.tradeSetupId}`===context.setupKey);
   cache.ranges.set(context.setupKey,{setupKey:context.setupKey,direction:context.direction,
    structureReady:structureReady(check.conditions,context.direction,knownAt),lastM1Time:knownAt-60,source});
   rememberStructure(minute);
   for(const event of minuteAlarmEvents({...minute,structureFirstKnownAt:cache.structures.get(context.setupKey)},tradingWindows)){
    event.missed_reason=deliveryReason({signalAt:seconds(event.signal_at),lastSuccess:previous.lastSuccessAt,
     nextDue:seconds(previous.nextExpectedCheck),latestClosed,startup:startup&&!Number.isFinite(lastProcessed),now});
    events.push(event);
   }
  };
  await scanTradeSetup2Window({...input,existingEntries:[...entries.values()],m1Candles:cache['1m'],fromTime,toTime:latestClosed,onMinuteCheck});
  const active=[];let evaluationError=null;
  for(const [setupKey,snapshot] of ranges){
   if(snapshot.dealingRange?.status!=='validated' || snapshot.rangeCourse?.lifecycle?.main?.state==='ended')continue;
   if(snapshot.rangeCourse?.lifecycle?.main?.state==='unknown'){evaluationError=`DR ${setupKey}: Lifecycle-Historie fehlt oder ist lueckenhaft`;continue;}
   const source=sources.find(s=>`${instrument}:setup1:${s.tradeSetupId}`===setupKey);
   const range=cache.ranges.get(setupKey) ?? {setupKey,direction:snapshot.direction,structureReady:false,lastM1Time:null,source};
   if(snapshot.rangeCourse?.lifecycle?.entrySearchAllowed===false)range.structureReady=false;
   active.push(range);
  }
  // Ohne aktive DR genügt ein echter M5-Schritt. Kein identischer Prozess-Heartbeat pro Minute.
  if(!startup && !events.length && !active.length && previous.lastM5Time===lastM5 && !previous.error && seconds(previous.nextExpectedCheck)>started/1000)return;
  const success=Date.now()/1000,lag=Math.floor(success/60)*60-latestClosed;
  const feedError=lag>120 && evaluateTradingHours({instrument,evaluatedAt:success,tradingWindows}).status==='passed'
   ? `FXCM-M1-Feed ${lag}s hinter geschlossenem Minutenstand` : null;
  const state={phase:active.length?'Setup 2 · M1 beobachten':'Setup 1 · M5 beobachten',activeRanges:active,
   entries:[...entries.values()],structureKnownAt:Object.fromEntries(cache.structures),lastProcessAt:iso(started/1000),lastSuccessAt:iso(success),lastM5Time:lastM5,
   lastM1Time:active.length?latestClosed-60:null,evaluatedThrough:iso(latestClosed),
   nextExpectedCheck:iso((active.length?Math.floor(success/60)*60+60:Math.floor(success/300)*300+300)+12),
   scanDurationMs:Date.now()-started,lastStep:active.length?'Geschlossene M1-Kerzen und Alarmstufen geprüft':'Geschlossene M5-Kerzen und Setup-1-Quellen geprüft',
   error:evaluationError ?? feedError,version:'entry-v9/setup-v20',initializedAt:previous.initializedAt ?? iso(success)};
  if(feedError)events.push({id:`feed:${instrument}:${lastM5}`,signal_at:iso(success),stage:0,kind:'problem',payload:{message:feedError,lastSuccessAt:previous.lastSuccessAt}});
  await request('rpc/setup2_checkpoint',{p_instrument:instrument,p_owner:owner,p_state:state,p_events:events});
  cache.entries=state.entries;
  console.log(JSON.stringify({instrument,processed:state.evaluatedThrough,active:active.length,events:events.length,scanDurationMs:state.scanDurationMs,error:state.error}));
 } catch(failure){
  const message=failure instanceof Error?failure.message:'Auswertung fehlgeschlagen';
  await request('rpc/setup2_checkpoint',{p_instrument:instrument,p_owner:owner,p_state:{...previous,lastProcessAt:iso(started/1000),error:message},p_events:[{
   id:`runner:${instrument}:${previous.lastSuccessAt ?? 'never'}:${message}`,signal_at:iso(Date.now()/1000),stage:0,kind:'problem',payload:{message,lastSuccessAt:previous.lastSuccessAt}}]});
  console.error(JSON.stringify({instrument,error:message}));
 }
}
while(true){
 try {
  const [states,sessions,schedules,news]=await Promise.all([client.pages('setup2_live_state',{select:'instrument,enabled,state',order:'instrument.asc'}),
   client.pages('sessions',{select:'*',order:'id.asc'}),client.pages('trading_schedules',{select:'*',order:'instrument.asc'}),
   client.pages('news_events',{select:'id,event_time,currency,title',order:'event_time.asc,id.asc',event_time:`gte.${iso(Date.now()/1000-86400*7)}`})]);
  for(const row of states.filter(s=>s.enabled))await instrumentTick(row,sessionRows(sessions),schedules,news);
  await drain();
 } catch(error){console.error(JSON.stringify({error:error instanceof Error?error.message:'Watcher failed'}));}
 if(process.env.WATCHER_ONCE==='1')break;
 await delay(Math.max(1000,((Math.floor(Date.now()/60000)+1)*60000+12000)-Date.now()));
}
