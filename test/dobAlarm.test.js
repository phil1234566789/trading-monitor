import {describe,expect,it} from 'vitest';
import {dobAlarmEvents,dobStaleAlarm,DOB_STALE_SECONDS} from '../src/dobAlarm.js';
import {load,run,berlin} from './dobFixtures.js';

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
