import {describe,expect,it} from 'vitest';
import {dobPoiTypeAlarmRuns,dobAlarmEvents} from '../src/dobAlarm.js';
import {DOB_GUARDRAILS_DEFAULT} from '../src/dobGuardrails.js';

// Watcher je Setup-Familie: eigene Konfig je Durchlauf, HTF-OB behält die alten Alarm-IDs, LS bekommt eigene, ein gesperrter
// Monat sperrt nur seine Familie.
const at=1794560400;
const retest={id:'dob:XAUUSD:-1:1000:2000:retest',pairId:'dob:XAUUSD:-1:1000:2000',instrument:'XAUUSD',direction:'short',phase:'ob2Retest',phaseSince:at,
 chart:{firstOrderBlockStart:1000,secondOrderBlockStart:2000,firstOrderBlock:{top:20,bottom:18},secondOrderBlock:{top:19,bottom:17}},poi:null};
const check=input=>({setups:[{...retest,seenWith:input.guardrails}],rejected:[],pairs:new Map()});
const poiTypes=[{poiType:'htf_ob',guardrails:{...DOB_GUARDRAILS_DEFAULT,defaultTpR:4}},{poiType:'lq_sweep',guardrails:DOB_GUARDRAILS_DEFAULT}];

it('rechnet jede Familie mit ihrer Konfig und eigenen Alarm-IDs',()=>{
 const seen=[];
 const runs=dobPoiTypeAlarmRuns({poiTypes,input:{},evaluatedAt:at,check:i=>(seen.push([i.poiType,i.guardrails.defaultTpR]),check(i))});
 expect(seen).toEqual([['htf_ob',4],['lq_sweep',2]]);
 const [htf,lq]=runs.map(r=>r.events[0]);
 expect(htf).toMatchObject({id:'dob:retest:XAUUSD:short:2000',poiType:'htf_ob'});
 expect(lq).toMatchObject({id:'dob:lq_sweep:retest:XAUUSD:short:2000',poiType:'lq_sweep'});
 // Kopfzeile ohne POI-Art (Philip); die Art steht in der POI-Zeile.
 expect(htf.text).toMatch(/^🟡 DOB XAUUSD Short · OB2-Retest/);
 expect(lq.text).toMatch(/^🟡 DOB XAUUSD Short · OB2-Retest/);
 expect(htf.text.split('\n')[1]).toBe('POI: –');
 expect(lq.text.split('\n')[1]).toBe('POI: LQ-Sweep');
});

it('gesperrter Monat einer Familie lässt die andere laufen',()=>{
 const month=new Date(at*1000).getUTCMonth()+1;
 const runs=dobPoiTypeAlarmRuns({poiTypes:[{...poiTypes[0],guardrails:{...poiTypes[0].guardrails,blockedMonths:[month]}},poiTypes[1]],input:{},evaluatedAt:at,check});
 expect(runs.map(r=>r.poiType)).toEqual(['lq_sweep']);
});

it('LQ-Sweep nennt das tragende TS1.1-Setup in der POI-Zeile, auch im Entry-Alarm',()=>{
 const poi={kind:'ts11',tradeSetupId:50160,match:'edge',gapUsd:0};
 const entry={...retest,id:'dob:XAUUSD:-1:1000:2000:a',route:'a',phase:'entry',entryTime:at,entryPrice:4113.57,stopPrice:4123.87,poi};
 const [lq]=dobPoiTypeAlarmRuns({poiTypes:[poiTypes[1]],input:{},evaluatedAt:at,check:()=>({setups:[{...retest,poi},entry],rejected:[],pairs:new Map()})});
 const lines=lq.events.map(e=>e.text.split('\n')[1]);
 expect(lines).toEqual(['POI: LQ-Sweep · TS1.1 #50160 · Kante','POI: LQ-Sweep · TS1.1 #50160 · Kante']);
});

describe('Entry-Alarm: TP nach Konfig',()=>{
 // Short, Entry 3.900,00, SL 3.910,00 → 1R = 10 USD. Statistik-Rechnung dobConfigTpR: Default, Zeitfenster-TP, Gegen-DOB tot → 5R.
 const entry=(extra={})=>({...retest,id:'dob:XAUUSD:-1:1000:2000:a',route:'a',phase:'entry',entryTime:at,entryPrice:3900,stopPrice:3910,...extra});
 const textOf=(setup,guardrails,reason)=>dobAlarmEvents({setups:reason?[]:[setup],rejected:reason?[{...setup,reason}]:[]},at,{guardrails}).find(e=>e.phase==='entry').text.split('\n');
 it('ohne Teilprofit: TP der Konfig mit Preis',()=>{
  expect(textOf(entry(),{...DOB_GUARDRAILS_DEFAULT,defaultTpR:4})).toContain('TP 4R @ 3.860,00');
 });
 it('Gegen-DOB tot im Kombi-Modus → 5R, mit Teilprofit TP1/TP2',()=>{
  const lines=textOf(entry({counterDob:{status:'dead'}}),{...DOB_GUARDRAILS_DEFAULT,counterDobMode:'live_block_dead_5r',partialAtR:3,partialPct:50,partialBe:true});
  expect(lines).toContain('TP1 3R @ 3.870,00 (50 %, danach SL auf Entry) · TP2 5R @ 3.850,00');
 });
 it('⛔-Warnung bekommt keinen TP, Forex-Preise mit 5 Stellen',()=>{
  expect(textOf(entry(),{...DOB_GUARDRAILS_DEFAULT},'blockedEntryHour').some(l=>l.startsWith('TP'))).toBe(false);
  const fx=entry({instrument:'GBPUSD',entryPrice:1.315,stopPrice:1.316});
  expect(textOf(fx,{...DOB_GUARDRAILS_DEFAULT})).toContain('TP 2R @ 1,31300');
 });
});
