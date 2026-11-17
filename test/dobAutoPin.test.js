import {beforeEach,expect,it} from 'vitest';
import {dobAutoPin} from '../src/dobAutoPin.js';

// In-Memory-Supabase mit genau den Abfrageformen, die dobAutoPin und der DOB-Pin-Speicher benutzen.
function fakeDb(tables){
 let nextId=100;
 const query=(table,rows)=>{
  let filters=[],write=null;
  const q={select:()=>q,eq:(k,v)=>(filters.push(r=>r[k]===v),q),neq:(k,v)=>(filters.push(r=>r[k]!==v),q),in:(k,v)=>(filters.push(r=>v.includes(r[k])),q),
   like:(k,p)=>(filters.push(r=>String(r[k]).startsWith(p.replace(/%$/,''))),q),match:o=>(Object.entries(o).forEach(([k,v])=>filters.push(r=>r[k]===v)),q),limit:()=>q,
   upsert:(row,{onConflict,ignoreDuplicates})=>(write=()=>{const keys=onConflict.split(','),hit=rows.find(r=>keys.every(k=>r[k]===row[k]));
    if(hit){if(!ignoreDuplicates)Object.assign(hit,row);return ignoreDuplicates?[]:[hit];}const saved={id:nextId++,...row};rows.push(saved);return [saved];},q),
   update:fields=>(write=()=>{const hit=rows.filter(r=>filters.every(f=>f(r)));hit.forEach(r=>Object.assign(r,fields));return hit;},q),
   run(){return write?write():rows.filter(r=>filters.every(f=>f(r)));},
   maybeSingle:async()=>({data:q.run()[0]??null,error:null}),single:async()=>({data:q.run()[0],error:null}),
   then:(ok,fail)=>Promise.resolve({data:q.run(),error:null}).then(ok,fail)};
  return q;
 };
 return {tables,from:t=>query(t,tables[t]??=[])};
}
const pair={id:'dob:XAUUSD:-1:1000:2000',instrument:'XAUUSD',direction:'short',recognizedAt:2400,
 firstOrderBlock:{dir:-1,timeframe:'5M',startTime:1000,top:20,bottom:18},secondOrderBlock:{dir:-1,timeframe:'5M',startTime:2000,top:19,bottom:17},
 firstRetest:{candleTime:1500},secondRetest:{candleTime:2400}};
const setup={id:`${pair.id}:retest`,pairId:pair.id,poi:{timeframe:'H1',zoneStartTime:3600}};
const candles=(n,step)=>Array.from({length:n},(_,i)=>({time:i*step+60}));
const args=event=>({event,setup,pair,evaluatedAt:3000,m5Candles:candles(5,300),m1Candles:candles(20,60)});
const retest={id:'dob:retest:XAUUSD:short:2000',signalAt:2400},entry={id:'dob:entry:XAUUSD:short:2700:17:19.5',signalAt:2700};
let db;
beforeEach(()=>{db=fakeDb({dob_alarm_events:[{id:retest.id,poi_type:'htf_ob',setup_id:setup.id,status:'sent'}],pin_context:[],
 ob_zones:[{id:7,instrument:'XAUUSD',timeframe:'1H',direction:'short',start_time:new Date(3600e3).toISOString()}]});});

it('pinnt beim ersten Alarm den DOB und seine H1-POI',async()=>{
 const res=await dobAutoPin(db,args(retest));
 const pins=db.tables.pin_context;
 expect(pins.map(p=>p.kind).sort()).toEqual(['double_order_block','ob_zone']);
 expect(pins.find(p=>p.kind==='ob_zone').ob_zone_id).toBe(7);
 expect(pins.find(p=>p.kind==='double_order_block').dob_context.pair.firstOrderBlock.obZoneId).toBeGreaterThan(0);
 expect(res.poi.obZoneId).toBe(7);
});

it('pinnt beim Folgealarm desselben Paars nichts',async()=>{
 await dobAutoPin(db,args(retest));
 db.tables.dob_alarm_events.push({id:entry.id,poi_type:'htf_ob',setup_id:`${pair.id}:b`,status:'sent'});
 db.tables.pin_context.length=0;
 expect(await dobAutoPin(db,args(entry))).toEqual({skipped:'notFirstAlarm'});
 expect(db.tables.pin_context).toEqual([]);
});

it('ist idempotent und lässt einen vorhandenen Pin samt Notiz stehen',async()=>{
 await dobAutoPin(db,args(retest));
 for(const p of db.tables.pin_context)p.note='Philips Notiz';
 await dobAutoPin(db,args(retest));
 expect(db.tables.pin_context).toHaveLength(2);
 expect(db.tables.pin_context.every(p=>p.note==='Philips Notiz')).toBe(true);
 expect(db.tables.ob_zones.filter(z=>z.timeframe==='5M')).toHaveLength(2);
});

it('legt keine fehlende H1/H4-Zone an, sondern meldet den Fehler',async()=>{
 db.tables.ob_zones.length=0;
 await expect(dobAutoPin(db,args(retest))).rejects.toThrow('nicht in ob_zones');
 expect(db.tables.ob_zones.some(z=>z.timeframe==='1H')).toBe(false);
});

it('LQ-Sweep: eigene Alarm-Historie, DOB-Pin ja, POI-Pin ist nur ein Haken',async()=>{
 // Ein HTF-OB-Alarm desselben Paars zählt für LQ-Sweep nicht als früherer Alarm.
 const res=await dobAutoPin(db,args({...entry,poiType:'lq_sweep'}));
 expect(res.poi).toEqual({skipped:'lqSweepPoiPinPending'});
 expect(db.tables.pin_context.map(p=>p.kind)).toEqual(['double_order_block']);
});
