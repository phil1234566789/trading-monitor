import {formatBerlinTime} from '../../../src/berlinTime.js';
import {sendPushover,sendTelegramText} from './setup2Notifications.js';

// Versand des dob-watchers als Outbox: die Erkennung legt Zeilen als pending an, flushDobOutbox() sendet danach alle parallel, damit
// ein hängendes Telegram weder die Minute noch die anderen Instrumente aufhält. Telegram hat keinen Idempotenz-Schlüssel, eine
// unklare Annahme wird deshalb genau einmal wiederholt, sichtbar als Wiederholung markiert (ein Duplikat ist erkennbar). Bleibt
// sie unklar oder lehnt Telegram ab, kommt eine Ausfallmeldung über Pushover; das Panel zeigt sie ohnehin.
export const DOB_DELIVERY={maxAttempts:2,retryAfterS:60,stuckS:120,sendWindowS:1800,lookbackS:86400};
const sec=v=>v?Date.parse(v)/1000:null;
const iso=s=>new Date(s*1000).toISOString();
const must=({data,error})=>{if(error)throw new Error(error.message);return data;};
const definite=error=>/rejected|missing/.test(error??'');

export const dobRetryText=row=>`↻ Wiederholung · Erstversand ${formatBerlinTime(sec(row.detected_at))} unklar, evtl. doppelt\n${row.text}`;

// Reiner Plan: was jetzt (erneut) gesendet wird und was aufgegeben und gemeldet wird. 'sending' ohne Abschluss nach stuckS heißt,
// der Lauf starb mitten im Versand: zählt wie unklar.
export function dobDeliveryPlan(rows,nowSec,cfg=DOB_DELIVERY){
 const send=[],giveUp=[];
 for(const row of rows){
  if(row.outage_notified_at)continue;
  const age=nowSec-sec(row.detected_at),idle=nowSec-(sec(row.last_attempt_at)??sec(row.detected_at));
  if(row.status==='sending'&&idle<cfg.stuckS)continue;
  const exhausted=row.status==='failed'&&definite(row.error)||row.attempts>=cfg.maxAttempts||age>cfg.sendWindowS;
  if(exhausted){giveUp.push(row);continue;}
  if(row.status==='pending')send.push({row,text:row.text});
  else if(idle>=cfg.retryAfterS)send.push({row,text:dobRetryText(row)});
 }
 return {send,giveUp};
}

export const dobOutageText=rows=>`DOB-Alarme nicht sicher auf Telegram angekommen:\n${rows.map(r=>
 `${formatBerlinTime(sec(r.detected_at))} ${r.text.split('\n')[0]} · ${r.status==='failed'?'abgelehnt':r.attempts?'Annahme unklar':'nicht gesendet'}`).join('\n')}`;

export async function flushDobOutbox(client,env,nowSec,{send=sendTelegramText,notify=sendPushover,cfg=DOB_DELIVERY}={}){
 const rows=must(await client.from('dob_alarm_events').select('id,text,status,error,attempts,last_attempt_at,detected_at,outage_notified_at')
  .in('status',['pending','sending','uncertain','failed']).is('outage_notified_at',null).gte('detected_at',iso(nowSec-cfg.lookbackS)).order('detected_at').limit(200));
 const plan=dobDeliveryPlan(rows,nowSec,cfg);
 const results=(await Promise.all(plan.send.map(async ({row,text})=>{
  // Claim: nur wer Status und Versuchszahl unverändert vorfindet, sendet; ein überlappender Cron-Lauf geht leer aus.
  const attempts=row.attempts+1;
  const claimed=must(await client.from('dob_alarm_events').update({status:'sending',attempts,last_attempt_at:iso(nowSec)})
   .eq('id',row.id).eq('status',row.status).eq('attempts',row.attempts).select('id'));
  if(!claimed.length)return null;
  let status='sent',error=null;
  try{await send(text,env);}
  catch(failure){error=failure instanceof Error?failure.message:'Telegram failed';status=definite(error)?'failed':'uncertain';}
  must(await client.from('dob_alarm_events').update({status,error,sent_at:status==='sent'?new Date().toISOString():null}).eq('id',row.id));
  return {...row,status,error,attempts};
 }))).filter(Boolean);
 const lost=[...plan.giveUp,...results.filter(r=>r.status==='failed'||r.status==='uncertain'&&r.attempts>=cfg.maxAttempts)];
 let outage=null;
 if(lost.length){
  // Einmal je Zeile melden, auch wenn Pushover selbst scheitert (sonst jede Minute ein neuer, evtl. doppelter Versuch).
  must(await client.from('dob_alarm_events').update({outage_notified_at:iso(nowSec)}).in('id',lost.map(r=>r.id)));
  // Hängengebliebenes 'sending' ist unklar, ein nie gesendetes 'pending' (Watcher fiel länger aus) ist nicht zugestellt.
  const settle=(status,error,ids)=>ids.length?client.from('dob_alarm_events').update({status,...error?{error}:{}}).in('id',ids).then(must):null;
  await Promise.all([settle('uncertain',null,lost.filter(r=>r.status==='sending').map(r=>r.id)),
   settle('failed','not sent: older than send window',lost.filter(r=>r.status==='pending').map(r=>r.id))]);
  try{await notify(dobOutageText(lost),'DOB-Watcher · Telegram-Ausfall',env);outage='notified';}
  catch(failure){outage=failure instanceof Error?failure.message:'Pushover failed';}
 }
 return {sent:results.map(r=>({id:r.id,status:r.status,attempts:r.attempts})),lost:lost.map(r=>r.id),outage};
}
