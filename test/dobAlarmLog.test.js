import {describe,expect,it} from 'vitest';
import {dobAlarmLogRows} from '../src/dobAlarmLog.js';

// Zeilen wie in dob_alarm_events (GBPUSD LQ-Sweep, 18.11.).
const entry={id:'dob:lq_sweep:entry:GBPUSD:long:1794969840:1.32047:1.32025',instrument:'GBPUSD',phase:'entry',poi_type:'lq_sweep',direction:'long',
 signal_at:'2026-11-18T02:44:00Z',detected_at:'2026-11-18T02:45:00Z',sent_at:null,status:'suppressed',error:'outsideAlarmWindow',guardrail:null,
 text:'🟢 DOB GBPUSD Long · Entry b 03:44\nPOI: LQ-Sweep · TS1.1 #50728 · Kante\nEntry 1,32047 · SL 1,32025\nTP 2R @ 1,32091\nhttps://example.test/#/?dob=x'};

describe('DOB-Alarme im Protokoll',()=>{
 it('Entry: Typ mit POI-Art, Preise aus dem Text, Link wie im Alarm, Grund der Unterdrückung',()=>{
  const [row]=dobAlarmLogRows([entry]);
  expect(row).toMatchObject({typeLabel:'DOB LQ-Sweep · Entry',directionLabel:'Long',price:'1,32047',detail:'SL 1,32025 · TS1.1 #50728 · Kante',
   link:'https://example.test/#/?dob=x',deliveryLabel:'unterdrückt · außerhalb Alarmfenster',time:entry.signal_at});
 });
 it('gesendet: Zeit = sent_at; gesendete Sperre als ⛔; Test weg, Datenlücke als Systemzeile',()=>{
  const rows=dobAlarmLogRows([{...entry,status:'sent',error:null,sent_at:'2026-11-18T02:44:30Z'},
   {...entry,id:'b',status:'sent',error:null,guardrail:'counterDob',poi_type:'htf_ob'},
   {id:'t',phase:'test',status:'sent',text:'🧪'},{id:'s',phase:'stale',instrument:'GBPUSD',status:'sent',text:'⚠️ …',signal_at:'2026-11-18T03:00:00Z'}]);
  expect(rows.map(r=>r.typeLabel)).toEqual(['DOB LQ-Sweep · Entry','DOB HTF-OB · ⛔ Entry','DOB-Watcher']);
  expect(rows[0]).toMatchObject({time:'2026-11-18T02:44:30Z',deliveryLabel:'TG ✅'});
  expect(rows[2]).toMatchObject({detail:'keine neuen M1-Kerzen',link:null});
 });
});
