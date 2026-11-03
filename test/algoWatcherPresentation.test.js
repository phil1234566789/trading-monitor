import {expect,it} from 'vitest';
import {watcherRangeEvidence,watcherMarketPause} from '../services/setup2/watcherRangeEvidence.js';
import {isExpectedWatcherPause,watcherIssuePhase,watcherSuspensionGroups} from '../src/algoWatcherPresentation.js';
import {healthReport} from '../supabase/functions/_shared/setup2Notifications.js';

const snapshot = {setupKey:'GBPUSD:setup1:1', direction:'long', knownAt:100,
 dealingRange:{status:'validated'}, rangeCourse:{lifecycle:{entrySearchAllowed:true}}};

it('shows saved DR stage and explicit missing condition without making optional BOS a blocker',()=>{
 const m1={entryPattern:'countertrend-entry-model-1-v10', evaluatedAt:100,
  conditions:{m5Bos:null,m1PivotBreak:null}};
 expect(watcherRangeEvidence(snapshot,null,m1)).toMatchObject({
  stage:'validated',step:'H · Entry finden',missing:'M1-Pivotbruch'
 });
 expect(watcherRangeEvidence(snapshot,null,{...m1,conditions:{m5Bos:null}}).missing).toBeNull();
});

it('requires timely active anti-confluence evidence for disqualification',()=>{
 const range={...snapshot,dealingRange:{status:'disqualified',fShowstoppers:[{recognizedAt:101}]}};
 expect(watcherRangeEvidence(range).stage).toBe('unknown');
 range.dealingRange.fShowstoppers[0].recognizedAt=100;
 expect(watcherRangeEvidence(range).stage).toBe('disqualified');
});

it('keeps a later price outcome separate from the DR stage',()=>{
 const range={...snapshot,rangeCourse:{lifecycle:{entrySearchAllowed:false,main:{state:'ended',reason:'invalidation'}}}};
 expect(watcherRangeEvidence(range,{price:1.25,recognizedAt:99})).toMatchObject({
  stage:'validated',step:'Entry-Suche beendet',lifecycle:'ended',entry:{price:1.25,recognizedAt:99}
 });
});

it('separates current suspensions from historical warnings and technical messages',()=>{
 const instruments=[{instrument:'GBPUSD',suspendedRanges:[{setupKey:'now'}]}];
 const events=[
  {id:1,kind:'problem',setup_key:'now',payload:{category:'range-warning'}},
  {id:2,kind:'problem',setup_key:'old',payload:{category:'range-warning'}},
  {id:3,kind:'problem',payload:{message:'storage error'}}
 ];
 expect(watcherSuspensionGroups(instruments,events)).toMatchObject({current:[{setupKey:'now'}],historical:[{id:2}]});
 expect(watcherIssuePhase('unknown')).toBe('Schritt unbekannt');
 expect(watcherIssuePhase('unknown','save')).toBe('Speichern');
 expect(watcherIssuePhase('Watcher database POST rpc/setup2_store_live_evidence instrument=GBPUSD: response headers, TimeoutError')).toBe('Speichern');
 expect(watcherIssuePhase('Archive trade_setups instrument=eq.GBPUSD: response body, TimeoutError')).toBe('Abruf');
});

it('only recognizes an evidenced gap entirely inside 23:00–00:00 Berlin',()=>{
 const pause={reason:'scheduledMarketGap',from:'2026-11-03T22:00:00Z',until:'2026-11-03T23:00:00Z'};
 expect(isExpectedWatcherPause(pause)).toBe(true);
 expect(isExpectedWatcherPause({...pause,until:'2026-11-03T23:01:00Z'})).toBe(false);
 expect(isExpectedWatcherPause({...pause,reason:'missingHistory'})).toBe(false);
 expect(isExpectedWatcherPause({...pause,from:'2026-07-03T21:00:00Z',until:'2026-07-03T22:00:00Z'})).toBe(true);
});

it('passes newly recorded display evidence through health without changing old reports',()=>{
 const range=watcherRangeEvidence(snapshot);
 const report=healthReport([{instrument:'GBPUSD',enabled:true,state:{rangeChecks:[range],errorPhase:'fetch'}},
  {instrument:'EURUSD',enabled:true,state:{}}],{});
 expect(report.instruments[0]).toMatchObject({rangeChecks:[range],errorPhase:'fetch'});
 expect(report.instruments[1]).toMatchObject({rangeChecks:[],errorPhase:null});
});

it('keeps a suspended DR without known history distinct from a finished DR',()=>{
 const range={...snapshot,rangeCourse:{lifecycle:{entrySearchAllowed:false,main:{state:'unknown',reason:'missingHistory'}}}};
 expect(watcherRangeEvidence(range)).toMatchObject({stage:'validated',step:'Entry-Suche ohne belegte Freigabe',lifecycle:'unknown',missing:null});
});

it('records a pause only when both adjacent candles prove the extent of the gap',()=>{
 const from=Date.parse('2026-11-03T22:00:00Z')/1000;
 const before={time:from-60}, after={time:from+3600};
 expect(isExpectedWatcherPause(watcherMarketPause([before,after],from))).toBe(true);
 expect(watcherMarketPause([after],from)).toBeNull();
 expect(watcherMarketPause([before,{time:after.time+60}],from)).toBeNull();
});
