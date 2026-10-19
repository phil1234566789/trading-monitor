import assert from 'node:assert/strict';
import fs from 'node:fs';
import {healthReport} from '../../supabase/functions/_shared/setup2Notifications.js';
export async function checkOperationalIncidents(db){
 const at=new Date('2026-10-19T11:45:00Z'),later=seconds=>new Date(+at+seconds*1000).toISOString();
 const summary={message:'Marktbeobachtung ausgefallen',action:'Beobachtung selbst übernehmen',lastSuccessAt:later(-600),
  instruments:[{instrument:'GBPUSD',enabled:true,lastSuccessAt:later(-600),marketWatermark:later(-660)}]};
 const update=(critical,ready,seconds,value=summary)=>db.query('select setup2_update_operational_incident($1,$2,$3,$4) result',[critical,ready,value,later(seconds)]);
 await db.exec("update setup2_live_state set enabled=true;select setup2_record_problem('legacy','GBPUSD','{}');");
 const original=(await db.query("select payload from setup2_alarm_events where id='legacy'")).rows;
 await db.exec(fs.readFileSync('supabase/migrations/20261019140000_setup2_operational_incidents.sql','utf8'));
 assert.deepEqual((await db.query("select payload from setup2_alarm_events where id='legacy'")).rows,original);
 assert.equal((await db.query("select status from setup2_notification_outbox where event_id='legacy'")).rows[0].status,'suppressed');
 await db.exec("select setup2_record_problem('retryable','GBPUSD','{}');");
 assert.equal((await db.query("select count(*)::int n from setup2_notification_outbox where event_id='retryable'")).rows[0].n,0);
 await db.exec("insert into setup2_alarm_events(id,signal_at,instrument,stage,kind) values('trade',now(),'GBPUSD',3,'trading');insert into setup2_notification_outbox(event_id,channel) values('trade','pushover');");
 assert.equal((await db.query("select status from setup2_notification_outbox where event_id='trade'")).rows[0].status,'pending');
 for(let minute=45;minute<=49;minute++){
  const checked=Date.parse(`2026-10-19T13:${minute}:03+02:00`);
  const instruments=['GBPUSD','EURUSD'].map(instrument=>({instrument,enabled:true,state:{
   activeRanges:[{setupKey:'original-sequence'}],lastSuccessAt:new Date(checked-20000).toISOString(),
   evaluatedThrough:new Date(checked-123000).toISOString(),nextExpectedCheck:new Date(checked+9000).toISOString(),
   error:instrument==='GBPUSD'&&minute===48?'Watcher database POST rpc/setup2_store_live_evidence: response headers, request failed, 31741ms':null
  }}));
  const report=healthReport(instruments,{},checked,()=>true,{watch_checked_at:new Date(checked-10000).toISOString(),provider_checked_at:new Date(checked-30000).toISOString()});
  assert.equal(report.actionRequired,false);assert.equal(report.state,'warning');
  await db.query('select setup2_update_operational_incident($1,$2,$3,$4)',[report.actionRequired,report.recoveryReady,{...summary,instruments:report.instruments},new Date(checked).toISOString()]);
 }
 await update(false,false,0);assert.equal((await db.query('select count(*)::int n from setup2_operational_incidents')).rows[0].n,0);
 const first=(await update(true,false,1)).rows[0].result;
 await update(true,false,2,{...summary,instruments:[{...summary.instruments[0],instrument:'EURUSD'}]});
 await update(true,false,3);
 assert.equal((await db.query('select setup2_operational_incident_status($1) status',[first.eventId])).rows[0].status,'critical');assert.equal((await db.query('select count(*)::int n from setup2_operational_incidents')).rows[0].n,1);
 assert.equal((await db.query("select count(*)::int n from setup2_notification_outbox where event_id=$1",[first.eventId])).rows[0].n,1);
 await db.query("update setup2_notification_outbox set status='uncertain',attempts=1 where event_id=$1",[first.eventId]);
 assert.ok((await db.query('select last_attempt_at from setup2_notification_outbox where event_id=$1',[first.eventId])).rows[0].last_attempt_at);
 await update(true,false,4);assert.equal((await db.query('select attempts from setup2_notification_outbox where event_id=$1',[first.eventId])).rows[0].attempts,1);
 const healthy={...summary,instruments:[{instrument:'GBPUSD',enabled:true,lastSuccessAt:later(20),marketWatermark:later(10)}]};
 await update(false,true,12,{...healthy,instruments:[{...healthy.instruments[0],marketWatermark:summary.instruments[0].marketWatermark}]});
 assert.equal((await db.query('select healthy_since from setup2_operational_incidents where closed_at is null')).rows[0].healthy_since,null);
 await update(false,true,20,healthy);await update(false,true,141,{...healthy,instruments:[{...healthy.instruments[0],lastSuccessAt:later(140),marketWatermark:later(130)}]});
 assert.equal((await db.query("select count(*)::int n from setup2_alarm_events where kind='recovery'")).rows[0].n,0);
 assert.equal((await db.query('select setup2_operational_incident_status($1) status',[first.eventId])).rows[0].status,'superseded');
 const second=(await update(true,false,150)).rows[0].result;
 await db.query("update setup2_notification_outbox set status='accepted',provider_accepted_at=$2 where event_id=$1",[second.eventId,later(151)]);
 const fresh={...healthy,instruments:[{...healthy.instruments[0],lastSuccessAt:later(180),marketWatermark:later(170)}]};
 await update(false,true,180,fresh);await update(false,true,299,fresh);
 assert.equal((await db.query("select count(*)::int n from setup2_alarm_events where kind='recovery'")).rows[0].n,0);
 await update(false,true,301,{...fresh,instruments:[{...fresh.instruments[0],lastSuccessAt:later(300)}]});
 assert.equal((await db.query("select count(*)::int n from setup2_alarm_events where kind='recovery'")).rows[0].n,0);
 const progressed={...fresh,instruments:[{...fresh.instruments[0],lastSuccessAt:later(301),marketWatermark:later(290)}]};
 await update(false,true,302,progressed);await update(false,true,303,progressed);
 const recovery=(await db.query("select * from setup2_alarm_events where kind='recovery'")).rows;
 assert.equal(recovery.length,1);assert.equal(recovery[0].payload.category,'operational-recovery');
 assert.equal((await db.query('select setup2_operational_incident_status($1) status',[recovery[0].id])).rows[0].status,'ready');
 const third=(await update(true,false,310)).rows[0].result;
 assert.equal((await db.query('select setup2_operational_incident_status($1) status',[recovery[0].id])).rows[0].status,'superseded');

 await db.query("update setup2_notification_outbox set status='uncertain',attempts=1 where event_id=$1",[third.eventId]);
 await db.query("insert into setup2_notification_outbox(event_id,channel,status,provider_accepted_at) values($1,'telegram','accepted',$2)",[third.eventId,later(311)]);
 const fallbackFresh={...healthy,instruments:[{...healthy.instruments[0],lastSuccessAt:later(330),marketWatermark:later(320)}]};
 await update(false,true,330,fallbackFresh);
 await update(false,true,451,{...fallbackFresh,instruments:[{...fallbackFresh.instruments[0],lastSuccessAt:later(450),marketWatermark:later(440)}]});
 assert.equal((await db.query("select count(*)::int n from setup2_alarm_events where kind='recovery'")).rows[0].n,2);
 assert.equal((await db.query("select has_table_privilege('anon','setup2_operational_incidents','SELECT') allowed")).rows[0].allowed,false);
 assert.equal((await db.query("select has_function_privilege('anon','setup2_update_operational_incident(boolean,boolean,jsonb,timestamptz)','EXECUTE') allowed")).rows[0].allowed,false);
 return {legacyHistoryUnchanged:true,legacyPendingSuppressed:true,transientsProtocolOnly:true,tradingUnchanged:true,
  originalMinuteSpamSequenceCreatesNoPush:true,globalEpisodeAcrossReasonsAndReporters:true,realProgressDuringRecoveryRequired:true,uncertainNeverDuplicated:true,actualAttemptTimestamp:true,acceptedTelegramFallbackRecovery:true,recoveryOnlyAfterAcceptedCritical:true,stableRecovery120s:true,
  recoveryOnlyOnce:true,obsoleteRecoverySuppressed:true,privateServiceOnly:true,productionWrites:0};
}
