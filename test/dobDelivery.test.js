import {expect,it} from 'vitest';
import {flushDobOutbox} from '../supabase/functions/_shared/dobDelivery.js';
import {dobDeliveryIssues} from '../src/dobWatcherStatus.js';

// Telegram-Ausfall vom 18.11.: Anfrage hängt, Abbruch → unklar. Die Outbox wiederholt einmal markiert, meldet sonst den Ausfall
// über Pushover, sendet nie ein drittes Mal und nie doppelt bei überlappenden Läufen.
function fakeDb(rows){
 const from=()=>{
  let filters=[],write=null;
  const q={select:()=>q,order:()=>q,limit:()=>q,eq:(k,v)=>(filters.push(r=>r[k]===v),q),in:(k,v)=>(filters.push(r=>v.includes(r[k])),q),
   is:(k,v)=>(filters.push(r=>(r[k]??null)===v),q),gte:(k,v)=>(filters.push(r=>r[k]>=v),q),
   update:fields=>(write=fields,q),
   run(){const hit=rows.filter(r=>filters.every(f=>f(r)));if(write)hit.forEach(r=>Object.assign(r,write));return hit.map(r=>({...r}));},
   then:(ok,fail)=>Promise.resolve().then(()=>({data:q.run(),error:null})).then(ok,fail)};
  return q;
 };
 return {from};
}
const t0=Date.parse('2026-11-18T14:31:04Z')/1000;
const row=()=>({id:'dob:lq_sweep:retest:GBPUSD:long:1795006500',instrument:'GBPUSD',text:'🟡 DOB GBPUSD Long · OB2-Retest\nPOI: LQ-Sweep',
 status:'pending',error:null,attempts:0,last_attempt_at:null,detected_at:new Date(t0*1000).toISOString(),outage_notified_at:null});
const hang=async()=>{throw new Error('Telegram transport failed (acceptance unknown)');};
const env=()=>'x';

it('unklar → eine markierte Wiederholung → zugestellt',async()=>{
 const rows=[row()],texts=[];
 await flushDobOutbox(fakeDb(rows),env,t0,{send:hang});
 expect(rows[0]).toMatchObject({status:'uncertain',attempts:1});
 await flushDobOutbox(fakeDb(rows),env,t0+30,{send:t=>texts.push(t)});
 expect(texts).toEqual([]);
 await flushDobOutbox(fakeDb(rows),env,t0+60,{send:async t=>{texts.push(t);}});
 expect(texts[0]).toMatch(/^↻ Wiederholung · Erstversand 15:31 unklar, evtl\. doppelt\n🟡 DOB GBPUSD Long/);
 expect(rows[0]).toMatchObject({status:'sent',attempts:2});
});

it('zweimal unklar → Pushover-Ausfallmeldung genau einmal, kein dritter Versand',async()=>{
 const rows=[row()],notes=[];let sends=0;
 const send=async()=>{sends++;throw new Error('Telegram transport failed (acceptance unknown)');},notify=async m=>{notes.push(m);};
 for(const dt of [0,60,120,180])await flushDobOutbox(fakeDb(rows),env,t0+dt,{send,notify});
 expect(sends).toBe(2);
 expect(notes).toEqual(['DOB-Alarme nicht sicher auf Telegram angekommen:\n15:31 🟡 DOB GBPUSD Long · OB2-Retest · Annahme unklar']);
 expect(rows[0].outage_notified_at).not.toBeNull();
});

it('abgelehnt wird nicht wiederholt, aber gemeldet; überlappende Läufe senden einmal',async()=>{
 const rows=[row()],notes=[];let sends=0;
 await flushDobOutbox(fakeDb(rows),env,t0,{send:async()=>{sends++;throw new Error('Telegram rejected request (HTTP 400)');},notify:async m=>{notes.push(m);}});
 expect(rows[0].status).toBe('failed');expect(notes[0]).toMatch(/abgelehnt$/);
 const twin=[row()];
 await Promise.all([1,2].map(()=>flushDobOutbox(fakeDb(twin),env,t0,{send:async()=>{sends++;}})));
 expect(sends).toBe(2);
});

it('Lauf starb im Versand: nach 2 min unklar und wiederholt; Watcher-Ausfall > 30 min wird gemeldet statt spät gesendet',async()=>{
 const rows=[{...row(),status:'sending',attempts:1,last_attempt_at:new Date(t0*1000).toISOString()}],texts=[];
 await flushDobOutbox(fakeDb(rows),env,t0+60,{send:async t=>{texts.push(t);}});
 expect(texts).toEqual([]);
 await flushDobOutbox(fakeDb(rows),env,t0+120,{send:async t=>{texts.push(t);}});
 expect(texts[0]).toMatch(/^↻ Wiederholung/);
 const old=[row()],notes=[];
 await flushDobOutbox(fakeDb(old),env,t0+1801,{send:async t=>{texts.push(t);},notify:async m=>{notes.push(m);}});
 expect(old[0].status).toBe('failed');expect(notes[0]).toMatch(/nicht gesendet$/);expect(texts).toHaveLength(1);
});

it('Panel listet nicht zugestellte Alarme, laufender Versand erst nach 2 min',()=>{
 const iso=s=>new Date(s*1000).toISOString();
 const issues=dobDeliveryIssues([
  {id:'a',instrument:'GBPUSD',text:'🟢 DOB GBPUSD Long · Entry\nx',status:'uncertain',attempts:1,detected_at:iso(t0),outage_notified_at:null},
  {id:'b',instrument:'GBPUSD',text:'🟡 DOB GBPUSD Long · OB2-Retest',status:'uncertain',attempts:2,detected_at:iso(t0),outage_notified_at:iso(t0)},
  {id:'c',instrument:'XAUUSD',text:'🟡 DOB XAUUSD',status:'pending',attempts:0,detected_at:iso(t0+100),outage_notified_at:null},
 ],t0+120);
 expect(issues.map(i=>[i.asset,i.head,i.label,i.clock])).toEqual([
  ['GBP','🟢 DOB GBPUSD Long · Entry','Annahme unklar, Wiederholung folgt','15:31'],['GBP','🟡 DOB GBPUSD Long · OB2-Retest','Annahme unklar','15:31']]);
});
