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
it('unites live and late entries in one month without replacing original live facts',()=>{
 const catchup=row('late','catchup',{id:'later-entry',entry:{...entry,id:'later-entry',price:1.13}}),live=liveEvidenceView([event],[row(),catchup],run),late=liveEvidenceView([event],[row(),catchup],run+':catchup');
 expect(live.map(s=>s.entry.id)).toEqual(['entry','later-entry']);expect(live[0].entry).toEqual(entry);expect(live[0].liveEventId).toBe('event');
 expect(late).toEqual(live);expect(late.find(s=>s.id==='later-entry').evaluationMode).toBe('catchup');
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

it('keeps later outcome provenance separate from the pinned original entry and its original as-of time',()=>{
 const original=row(),observed={...row('later-observation','live',{id:'later-candidate',entry:null,knownAt:at+120}),captured_at:new Date((at+180)*1000).toISOString(),evaluated_through:new Date((at+120)*1000).toISOString(),observation:{priceObservation:{stage1:'target1'}}};
 const snapshots=liveEvidenceView([],[original,observed],run),snapshot=snapshots.find(s=>s.id==='entry'),group=reviewGroups(snapshots)[0];
 const context=simulationPinSnapshot({kind:'simulation_entry',group,entry:snapshot},{id:run},[]);
 expect(context.source).toMatchObject({recordId:'row',evaluatedThrough:new Date(at*1000).toISOString()});
 expect(context.observationSource).toMatchObject({recordId:'later-observation',capturedAt:observed.captured_at,evaluatedThrough:observed.evaluated_through});
 expect(snapshot.observationEvaluatedThrough).toBe(observed.evaluated_through);
});

it('deduplicates the original entry ID across sources and retains late review evidence independently',()=>{
 const original=row('original','live'),late={...row('late','catchup',{id:'different-snapshot-id',entry:{...entry,price:9},checklist:{status:'ready',model:'countertrend',evaluatedAt:at,checks:{m5Trend:{status:'passed'}},setup:{primary:{}}}}),captured_at:new Date((at+300)*1000).toISOString()};
 for(const events of [[event],[]]){
 const snapshots=liveEvidenceView(events,[late,original],run),snapshot=snapshots[0];
 expect(snapshots).toHaveLength(1);expect(snapshot.entry).toEqual(entry);expect(snapshot.evaluationMode).toBe('live');expect(snapshot.additionalChecks).toHaveLength(1);expect(snapshot.additionalChecks[0]).toMatchObject({evaluationMode:'catchup',entry:{price:9},evidenceRecordId:'late'});
 expect(runFunnel(reviewGroups(snapshots),liveEvidenceResults(snapshots)).entries).toBe(1);
 }
});
it('prefers actual live archive facts to an earlier late event without relabelling the late event as a live alarm',()=>{
 const lateEvent={...event,payload:{...event.payload,entry:{...entry,price:9},provenance:{evaluationMode:'catchup'}}};
 const snapshot=liveEvidenceView([lateEvent],[row('live','live')],run)[0];
 expect(snapshot.entry.price).toBe(entry.price);expect(snapshot.evaluationMode).toBe('live');expect(snapshot.liveEventId).toBeUndefined();expect(snapshot.additionalChecks.some(s=>s.liveEventId===event.id)).toBe(true);
});

it('preserves the entire original stop evidence required by pin validation, independently of JSONB key order',()=>{
 const stops={wide:{price:1.13,sourceTime:at-60,structuralPrice:1.14},narrow:{price:1.125}},original={...event,payload:{...event.payload,entry:{...entry,stops}}};
 const reordered={narrow:{price:1.125},wide:{structuralPrice:1.14,sourceTime:at-60,price:1.13}},same=row('same','live',{entry:{...entry,stops:reordered}});
 expect(liveEvidenceView([original],[same],run)[0].evidenceRecordId).toBe('same');
 const changed=row('changed','live',{entry:{...entry,stops:{...stops,wide:{...stops.wide,sourceTime:at-120}}}}),snapshot=liveEvidenceView([original],[changed],run)[0];
 expect(snapshot.entry.stops).toEqual(stops);expect(snapshot.evidenceRecordId).toBeUndefined();expect(snapshot.additionalChecks[0].evidenceRecordId).toBe('changed');
});

it('adds late observations without replacing original live checklist history from the same configuration',()=>{
 const original=row('original'),own={...row('live-history','live',{id:'live-minute',entry:null,knownAt:at+60}),evaluated_through:new Date((at+60)*1000).toISOString(),observation:{checklistHistory:{version:'saved',entries:['actual live history']}}};
 const late={...row('late-history','catchup',{id:'late-minute',entry:null,knownAt:at+120}),evaluated_through:new Date((at+120)*1000).toISOString(),observation:{checklistHistory:{version:'saved',entries:['retrospective history']},priceObservation:{stage1:'target1'}}};
 const snapshot=liveEvidenceView([],[original,late,own],run).find(snapshot=>snapshot.id==='entry');
 expect(snapshot.checklistHistory.entries).toEqual(['actual live history']);expect(snapshot.checklistHistoryRecordId).toBe('live-history');expect(snapshot.observationRecordId).toBe('late-history');expect(snapshot.observationEvaluationMode).toBe('catchup');
});
