import {describe,it,expect} from 'vitest';
import {minuteAlarmEvents,structureReady,deliveryReason} from '../services/setup2/events.js';
const ENTRY_PATTERN_1_VERSION='countertrend-entry-model-1-v9';
const at=Date.parse('2026-10-07T10:00:00Z')/1000;
const windows={weekday:[[0,1440]],saturday:[],sunday:[]};
const context={instrument:'GBPUSD',direction:'short',setupKey:'GBPUSD:setup1:42',validatedAt:at-600,confirmedAt:at-600};
function conditions({bosAt=at,pivotAt=at,counterAt=at-300,retestAt=null}={}) {
 return {m5Bos:{type:'BOS',direction:'short',originTime:at-1200,recognizedAt:bosAt},
 m5Countertrend:{trend:'uptrend',range:{high:{pivotTime:at-1200}},recognizedAt:counterAt},
 m1PivotBreak:{type:'pivot-break',direction:'short',recognizedAt:pivotAt},
 retest:retestAt==null?null:{recognizedAt:retestAt,orderBlock:{startTime:at-1800,dir:-1}}};
}
function alarms(facts,knownAt=at,snapshot=null,allowed=windows){return minuteAlarmEvents({context,check:{conditions:facts,entryPattern:ENTRY_PATTERN_1_VERSION},knownAt,snapshot},allowed);}
describe('T68 causal closed-minute alarm stages',()=>{
 it('emits structure at first causal ready minute once, with stable identity',()=>{
  expect(alarms(conditions()).map(e=>e.stage)).toEqual([1]);
  expect(alarms(conditions(),at+60)).toEqual([]);
  expect(alarms(conditions())[0].id).toBe(alarms(conditions())[0].id);
 });
 it('waits for the correct causal countertrend, including its knowledge timestamp',()=>{
  const facts=conditions({bosAt:at-60,pivotAt:at-60,counterAt:at});
  expect(structureReady(facts,'short',at-60)).toBe(false);
  expect(alarms(facts).map(e=>e.stage)).toEqual([1]);
 });
 it('does not turn older first readiness into a new signal when a later M5 observation advances',()=>{
  const facts=conditions({bosAt:at-60,pivotAt:at-60,counterAt:at});
  const event=minuteAlarmEvents({context,check:{conditions:facts,entryPattern:ENTRY_PATTERN_1_VERSION},knownAt:at,structureFirstKnownAt:at-60,snapshot:null},windows);
  expect(event).toEqual([]);
 });
 it('rejects BOS from another inner range and future pivot knowledge',()=>{
  const wrong=conditions();wrong.m5Bos.originTime--;
  expect(alarms(wrong)).toEqual([]);
  expect(alarms(conditions({pivotAt:at+60}))).toEqual([]);
 });
 it('never retrospectively announces an earlier retest when structure becomes ready',()=>{
  const facts=conditions({retestAt:at-120});
  expect(alarms(facts).map(e=>e.stage)).toEqual([1]);
  expect(alarms(facts,at+60)).toEqual([]);
 });
 it('announces a new retest only while both structure facts were already known',()=>{
  expect(alarms(conditions({bosAt:at-60,pivotAt:at-60,retestAt:at})).map(e=>e.stage)).toEqual([2]);
  expect(alarms(conditions({bosAt:at-60,pivotAt:at-60,retestAt:at}),at+60)).toEqual([]);
  expect(alarms(conditions({bosAt:at+60,pivotAt:at-60,retestAt:at}))).toEqual([]);
 });
 it('all trading stages obey trading_windows rather than independent alarm windows',()=>{
  expect(alarms(conditions({retestAt:at}),at,null,{weekday:[],saturday:[],sunday:[]})).toEqual([]);
 });
 it('Alarm3 contains actual clamped wide stop and independent narrow sizing',()=>{
  const entry={id:'executable',instrument:'GBPUSD',direction:'short',entryPattern:ENTRY_PATTERN_1_VERSION,recognizedAt:at,price:1.32411,
    stops:{wide:{price:1.325},narrow:{price:1.32454}}};
  const event=alarms(conditions({bosAt:at-60,pivotAt:at-60}),at,{entry})[0];
  expect(event.stage).toBe(3);
  expect(event.payload.variants.map(v=>v.variant)).toEqual(['wide','narrow']);
  expect(event.payload.variants[0].stopPrice).toBeCloseTo(1.32471,8);
  expect(event.payload.variants[1].stopPrice).toBeCloseTo(1.32454,8);
  expect(event.payload.variants[0].actualRisk).toBeLessThanOrEqual(500);
 });
 it('does not notify a raw ungated entry or a variant with no executable stop',()=>{
  const facts=conditions({bosAt:at-60,pivotAt:at-60});
  expect(alarms(facts)).toEqual([]);
  const entry={id:'invalid',instrument:'GBPUSD',direction:'short',entryPattern:ENTRY_PATTERN_1_VERSION,recognizedAt:at,price:1.3,stops:{wide:{price:1.2},narrow:{price:1.2}}};
  expect(alarms(facts,at,{entry})).toEqual([]);
 });
 it('initial or historical catchup remains log-only, current scheduled minute stays deliverable',()=>{
  expect(deliveryReason({startup:true,signalAt:at,latestClosed:at,now:at+20})).toContain('Aktivierung');
  expect(deliveryReason({startup:false,signalAt:at-60,latestClosed:at,now:at+20})).toContain('ältere');
  expect(deliveryReason({startup:false,signalAt:at,lastSuccess:at-40,nextDue:at+12,latestClosed:at,now:at+20})).toBeNull();
 });
});
