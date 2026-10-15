import {it,expect} from 'vitest';
import {liveEvidenceView,liveEvidenceResults} from '../src/liveEvidenceView.js';
import {savedLiveEntryFacts} from '../src/savedLiveEntryFacts.js';
import {reviewGroups,runFunnel,rangeEntryCrossTable} from '../src/simulationRunComparison.js';
import {simulationPinSnapshot} from '../src/simulationPinSnapshot.js';
import {COUNTERTREND_STAGE_VERSION} from '../src/tradeSetup2DealingRange.js';
const run='live-watcher:2026-10',at=Date.parse('2026-10-13T08:23:00Z')/1000;
const entry={id:'entry',recognizedAt:at,price:1.11857,entryCategory:'risky',entryPattern:'countertrend-entry-model-1-v10',confirmedAt:at-718,
 conditions:{m5Countertrend:{trend:'uptrend',recognizedAt:at-180}},scales:{wide:{targets:[{label:'T1',price:1.11533}]}}};
const event={id:'event',instrument:'EURUSD',direction:'short',setup_key:'dr',kind:'trading',stage:3,signal_at:new Date(at*1000).toISOString(),payload:{entry,variants:[]}};
const row=(id='row',mode='live',snapshot={})=>({id,snapshot_id:snapshot.id ?? 'entry',setup_key:'dr',instrument:'EURUSD',configuration_id:'config-original',evaluation_mode:mode,
 known_at:new Date(at*1000).toISOString(),captured_at:new Date((at+60)*1000).toISOString(),evaluated_through:new Date(at*1000).toISOString(),
 snapshot:{id:'entry',setupKey:'dr',instrument:'EURUSD',direction:'short',knownAt:at,entry,...snapshot},observation:{}});
it('preserves every original event entry and keeps explicitly late detections out of the live source',()=>{
 const catchup=row('late','catchup',{id:'later-entry',entry:{...entry,id:'later-entry',price:1.13}}),live=liveEvidenceView([event],[row(),catchup],run),late=liveEvidenceView([event],[row(),catchup],run+':catchup');
 expect(live.map(s=>s.entry.id)).toEqual(['entry']);expect(live[0].entry).toEqual(entry);expect(live[0].liveEventId).toBe('event');
 expect(late.map(s=>s.entry.id)).toEqual(['later-entry']);expect(late[0].evaluationMode).toBe('catchup');
 const conflicting=row('conflict','live',{entry:{...entry,price:9}});expect(liveEvidenceView([event],[conflicting],run)[0].entry.price).toBe(entry.price);
});
it('joins the latest nonempty observation separately, without substituting another original configuration or checklist',()=>{
 const original=row(),observed={...row('observation','live',{id:'minute',entry:null,knownAt:at+120}),captured_at:new Date((at+180)*1000).toISOString(),evaluated_through:new Date((at+120)*1000).toISOString(),configuration_id:'different-config',observation:{priceObservation:{stage1:'target1'},checklistHistory:{entries:['later']}}};
 const empty={...row('empty','live',{id:'empty',entry:null}),captured_at:new Date((at+240)*1000).toISOString(),evaluated_through:new Date((at+240)*1000).toISOString()};
 const snapshot=liveEvidenceView([], [original,observed,empty],run).find(s=>s.id==='entry');
 expect(snapshot.configurationId).toBe('config-original');expect(snapshot.priceObservation).toEqual({stage1:'target1'});expect(snapshot.checklistHistory).toBeUndefined();expect(snapshot.observationConfigurationId).toBe('different-config');expect(snapshot.observationRecordId).toBe('observation');expect(snapshot.liveObservedThrough).toBe(at+120);
});
it('shows partial original facts without turning missing DR decisions or prices into a known outcome',()=>{
 const snapshot=liveEvidenceView([event],[],run)[0],facts=savedLiveEntryFacts(snapshot).join(' '),groups=reviewGroups([snapshot]),funnel=runFunnel(groups,[]);
 expect(facts).toContain('Bestätigungszeit im Originalentry');expect(facts).toContain('D · M5-Countertrend');expect(facts).toContain('1,11533');expect(facts).toContain('Erreichen nicht gespeichert');
 expect(funnel.entries).toBe(1);expect(funnel.confirmed).toBe(0);expect(funnel.coverage.confirmationTimes).toBe(1);expect(funnel.unknown.validated).toBe(1);
 const table=rangeEntryCrossTable(groups,[],'wide');expect(table.find(r=>r.key==='stageUnknown')).toMatchObject({total:1,entries:1,pending:1});
});
it('freezes snapshot-source pins against the actual original row, including original month and capture provenance',()=>{
 const snapshot=liveEvidenceView([], [row('archive-sha','catchup',{dealingRange:{version:COUNTERTREND_STAGE_VERSION,status:'validated'}})],run+':catchup')[0];
 const group=reviewGroups([snapshot])[0],context=simulationPinSnapshot({kind:'simulation_entry',group,entry:snapshot},{id:run+':catchup'},[]);
 expect(context).toMatchObject({contextVersion:'simulation-pin-context-v4',runId:null,snapshotId:'entry',snapshotAt:{unix:at},stage:'validated',source:{kind:'live-watcher',recordId:'archive-sha',configurationId:'config-original',evaluationMode:'catchup',viewId:run+':catchup'}});
 expect(context.source).not.toHaveProperty('eventId');expect(context.source.capturedAt).toBe(new Date((at+60)*1000).toISOString());
});

it('keeps the complete DR outcome unknown when only the observed suffix after capture is available',()=>{
 const original=row('capture','live',{dealingRange:{version:COUNTERTREND_STAGE_VERSION,status:'validated'}});
 original.observation={coverage:{validatedAt:at,sourceValidatedAt:at-300,missingBeforeCapture:true},priceObservation:{stage1:'target1',stage2:'target2'}};
 const snapshots=liveEvidenceView([],[original],run),groups=reviewGroups(snapshots),funnel=runFunnel(groups,[]);
 expect(groups[0].outcome.status).toBe('unknown');expect(snapshots[0].priceObservation.stage2).toBe('target2');expect(funnel.target1).toBe(0);expect(funnel.target2).toBe(0);expect(funnel.unknown.target1).toBe(1);
});

it('retains stored entry stop prices even without an alarm sizing variant, without inventing lots or exit results',()=>{
 const snapshot=liveEvidenceView([],[row('no-alarm','live',{entry:{...entry,stops:{wide:{price:1.11917},narrow:{price:1.11887}}}})],run)[0];
 const results=liveEvidenceResults([snapshot]);expect(results.map(row=>row.stopPrice)).toEqual([1.11917,1.11887]);expect(results.every(row=>row.lots===undefined&&row.status==='notStored'&&row.netPnlUsd===null)).toBe(true);
});

it('links a DR pin back to the same archived candidate used by its immutable source context',()=>{
 const snapshots=liveEvidenceView([],[row(),row('candidate','live',{id:'candidate-original',knownAt:at+60,entry:null})],run),group=reviewGroups(snapshots)[0];
 const context=simulationPinSnapshot({kind:'simulation_dr',group},{id:run},[]);
 expect(context.snapshotId).toBe('candidate-original');expect(context.source.recordId).toBe('candidate');expect(context.chartLink.query.setup2).toBe(context.snapshotId);
});
