import {describe,expect,it} from 'vitest';
import {dobAlarmEvents,dobStaleAlarm,DOB_STALE_SECONDS} from '../src/dobAlarm.js';
import {load,run,berlin} from './dobFixtures.js';
import {DOB_GUARDRAILS_DEFAULT} from '../src/dobGuardrails.js';

describe('DOB-Alarme',()=>{
 // #134: Retest-Alarm ab dem OB2-Kontakt, Entry-Alarm beim Entry; mehrere OB1-Partner ergeben je einen Alarm.
 const fixture=load('2026-11-12');
 const done=run(fixture).setups.find(s=>s.entryTime===berlin('2026-11-12','14:10'));
 it('meldet den OB2-Retest einmal mit Quelle, Zonen und Chart-Link',()=>{
  const at=done.chart.secondRetestTime+60,events=dobAlarmEvents(run(fixture,at),at).filter(e=>e.phase==='ob2Retest');
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({id:`dob:retest:XAUUSD:short:${done.chart.secondOrderBlockStart}`,direction:'short',signalAt:at});
  expect(events[0].text).toContain('OB2-Retest');
  expect(events[0].text).toContain('H1-OB');
  expect(events[0].text).toContain('3.954,74–3.964,91');
  expect(events[0].text).toContain('erster Touch vor');
  expect(events[0].text).toContain('#/?dob=');
  // Entry-Zeit ist beim Retest offen, also auch das Fenster-Ziel.
  expect(events[0].text).not.toContain('TP 2R');
 });
 it('meldet den Entry mit Preis, SL und TP 2R',()=>{
  const at=done.entryTime+60,entry=dobAlarmEvents(run(fixture,at),at).find(e=>e.phase==='entry');
  expect(entry.id).toBe(`dob:entry:XAUUSD:short:${done.entryTime}:${done.entryPrice}:${done.stopPrice}`);
  expect(entry.text).toContain('Entry 3.929,65');
  expect(entry.text).toContain('TP 2R 3.893,05');
 });
 it('meldet alte Phasen nach einem Neustart nicht nach',()=>{
  const at=done.entryTime+60*60;
  expect(dobAlarmEvents(run(fixture,at),at)).toEqual([]);
 });
 it('warnt bei offenem Markt ohne neue Kerzen, nicht in der Tagespause',()=>{
  const open=berlin('2026-11-12','14:00');
  expect(dobStaleAlarm({lastM1Time:open-60,evaluatedAt:open})).toBeNull();
  expect(dobStaleAlarm({lastM1Time:open-60-DOB_STALE_SECONDS,evaluatedAt:open})).toMatchObject({phase:'stale'});
  // Tagespause 23:00–00:01 Berlin: fehlende Kerzen sind dort normal.
  const pause=berlin('2026-11-12','23:40');
  expect(dobStaleAlarm({lastM1Time:berlin('2026-11-12','22:59'),evaluatedAt:pause})).toBeNull();
 });
});

describe('DOB-Sperren (dob_guardrails) im Alarm',()=>{
 const fixture=load('2026-11-12');
 const done=run(fixture).setups.find(s=>s.entryTime===berlin('2026-11-12','14:10'));
 const withGuardrails=(at,config)=>run(fixture,at,true,undefined,{guardrails:{...DOB_GUARDRAILS_DEFAULT,...config}});
 // Entry 14:10 Berlin liegt im gesperrten Fenster 14:00–15:00.
 const hour={entryWindows:[{from:840,to:900,action:'block'}]};
 it('Entry-Stunde: Retest-Alarm geht normal raus, der Entry wird als Sperrzeit gemeldet',()=>{
  const retestAt=done.chart.secondRetestTime+60;
  expect(dobAlarmEvents(withGuardrails(retestAt,hour),retestAt).find(e=>e.phase==='ob2Retest')).toMatchObject({guardrail:null,suppressed:false});
  const at=done.entryTime+60,result=withGuardrails(at,hour);
  expect(result.setups.some(s=>s.entryTime===done.entryTime)).toBe(false);
  expect(result.rejected.find(s=>s.entryTime===done.entryTime)).toMatchObject({reason:'blockedEntryHour'});
  const entry=dobAlarmEvents(result,at).find(e=>e.phase==='entry');
  expect(entry).toMatchObject({id:`dob:entry:XAUUSD:short:${done.entryTime}:${done.entryPrice}:${done.stopPrice}`,guardrail:'blockedEntryHour',suppressed:false});
  expect(entry.text).toContain('Entry in Sperrzeit 14:10, kein Trade');
 });
 it('Entry-Stunde mit blockedEntryAlarm none: nur Protokoll',()=>{
  const at=done.entryTime+60;
  expect(dobAlarmEvents(withGuardrails(at,hour),at,{blockedEntryAlarm:'none'}).find(e=>e.phase==='entry')).toMatchObject({guardrail:'blockedEntryHour',suppressed:true});
 });
 it('Zonenalter: schon der Retest ist gesperrt (nur Protokoll)',()=>{
  const at=done.chart.secondRetestTime+60,result=withGuardrails(at,{minZoneAgeSeconds:10*365*86400});
  expect(result.setups.filter(s=>s.phase==='ob2Retest')).toEqual([]);
  expect(dobAlarmEvents(result,at).find(e=>e.phase==='ob2Retest')).toMatchObject({guardrail:'blockedZoneAge',suppressed:true});
 });
 it('ohne Regel: Standard-TP 2R wie ohne Konfig, nur mit Herkunft im Text',()=>{
  const at=done.entryTime+60,plain=dobAlarmEvents(run(fixture,at),at);
  const events=dobAlarmEvents(withGuardrails(at,{}),at);
  expect(events.map(e=>({...e,text:e.text.replace('TP 2R (Standard)','TP 2R')}))).toEqual(plain);
  expect(events.find(e=>e.phase==='entry').text).toContain('TP 2R (Standard) 3.893,05');
 });
 it('TP-Fensterregel: Ziel und Ausgang zum R des Entry-Fensters',()=>{
  const at=done.entryTime+60,rule={entryWindows:[{from:840,to:900,action:'tp',tpR:3}]};
  const setup=withGuardrails(at,rule).setups.find(s=>s.entryTime===done.entryTime);
  expect(setup).toMatchObject({tpRule:{tpR:3},targetPrice:expect.closeTo(3874.75,2)});
  expect(dobAlarmEvents(withGuardrails(at,rule),at).find(e=>e.phase==='entry').text).toContain('TP 3R (Fensterregel 14:00–15:00) 3.874,75');
  // Default-TP greift außerhalb jedes Fensters.
  expect(dobAlarmEvents(withGuardrails(at,{defaultTpR:2.5}),at).find(e=>e.phase==='entry').text).toContain('TP 2,5R (Standard)');
 });
});

describe('DOB: Gegenkerzen vor Entry im Alarm',()=>{
 const fixture=load('2026-11-12');
 const at=berlin('2026-11-12','14:11'),result=run(fixture,at),done=result.setups.find(s=>s.entryTime===berlin('2026-11-12','14:10'));
 it('Setup trägt die Merkmale; im Fixture nur 0 von 3 Gegenkerzen, also auch mit 3of3 kein Sperrgrund',()=>{
  expect(done.features).toEqual({counter_candles_3:0,counter_candles_5:2});
  const gated=run(fixture,at,true,undefined,{guardrails:{...DOB_GUARDRAILS_DEFAULT,counterCandlesMode:'3of3'}});
  expect(gated.setups.some(s=>s.entryTime===done.entryTime)).toBe(true);
 });
 it('gesperrter Entry: Warnung „3 Gegenkerzen vor Entry, kein Trade“, umschaltbar auf nur Protokoll',()=>{
  const blocked={setups:[],rejected:[{...done,reason:'counterCandles'}]};
  const entry=dobAlarmEvents(blocked,at).find(e=>e.phase==='entry');
  expect(entry).toMatchObject({guardrail:'counterCandles',suppressed:false});
  expect(entry.text).toContain('3 Gegenkerzen vor Entry 14:10, kein Trade');
  expect(dobAlarmEvents(blocked,at,{counterCandlesAlarm:'none'}).find(e=>e.phase==='entry')).toMatchObject({suppressed:true});
 });
});

describe('DOB v3: Gegen-DOB im Alarm',()=>{
 const fixture=load('2026-11-12');
 const done=run(fixture).setups.find(s=>s.entryTime===berlin('2026-11-12','14:10'));
 // Gate-Stub (Status), das echte Gate testet dobLabFeatures.test.js an Philips Pins; Sperre/TP kommen aus der Konfig.
 const gateWith=status=>s=>s.entryTime==null?null:{count:status==='none'?0:1,liveCount:status==='live'?1:0,status};
 const counterDobGate=gateWith('live');
 const cfg=counterDobMode=>({guardrails:{...DOB_GUARDRAILS_DEFAULT,counterDobMode}});
 it('Retest-Alarm bleibt, der Entry kommt als „Gegen-DOB seit Retest, kein Trade“',()=>{
  const retestAt=done.chart.secondRetestTime+60;
  expect(dobAlarmEvents(run(fixture,retestAt,true,undefined,{counterDobGate,...cfg('block_all')}),retestAt).find(e=>e.phase==='ob2Retest')).toMatchObject({guardrail:null,suppressed:false});
  const at=done.entryTime+60,result=run(fixture,at,true,undefined,{counterDobGate,...cfg('block_all')});
  expect(result.version).toBe('dob-setup-v3');
  expect(result.rejected.find(s=>s.entryTime===done.entryTime)).toMatchObject({reason:'counterDob'});
  const entry=dobAlarmEvents(result,at).find(e=>e.phase==='entry');
  expect(entry).toMatchObject({guardrail:'counterDob',suppressed:false});
  expect(entry.text).toContain('Gegen-DOB seit Retest, Entry 14:10, kein Trade');
  expect(dobAlarmEvents(result,at,{counterDobAlarm:'none'}).find(e=>e.phase==='entry')).toMatchObject({suppressed:true});
 });
 it('Modus aus der Konfig: tot sperrt bei block_all, gibt TP 5R bei live_block_dead_5r; off und ohne Konfig sperren nie',()=>{
  const at=done.entryTime+60,dead=gateWith('dead'),entryOf=r=>r.setups.find(s=>s.entryTime===done.entryTime);
  expect(run(fixture,at,true,undefined,{counterDobGate:dead,...cfg('block_all')}).rejected.find(s=>s.entryTime===done.entryTime)).toMatchObject({reason:'counterDob'});
  const combo=run(fixture,at,true,undefined,{counterDobGate:dead,...cfg('live_block_dead_5r')});
  expect(entryOf(combo)).toMatchObject({tpRule:{tpR:5,source:'deadCounterDob'},counterDob:{status:'dead'}});
  expect(dobAlarmEvents(combo,at).find(e=>e.phase==='entry').text).toContain('TP 5R (nur tote Gegen-DOBs)');
  expect(run(fixture,at,true,undefined,{counterDobGate:gateWith('live'),...cfg('live_block_dead_5r')}).rejected.find(s=>s.entryTime===done.entryTime)).toMatchObject({reason:'counterDob'});
  expect(entryOf(run(fixture,at,true,undefined,{counterDobGate,...cfg('off')}))).toBeTruthy();
  // Statistik ohne Konfig: Status nur vermerkt, nichts gesperrt.
  expect(entryOf(run(fixture,at,true,undefined,{counterDobGate}))).toMatchObject({counterDob:{status:'live'}});
 });
});
