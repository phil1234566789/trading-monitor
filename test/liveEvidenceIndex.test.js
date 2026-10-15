import {expect,it} from 'vitest';
import {selectLiveEvidenceIndex} from '../src/liveEvidenceIndex.js';
import {liveEvidenceView} from '../src/liveEvidenceView.js';
import {reviewGroups} from '../src/simulationRunComparison.js';
import {DEALING_RANGE_VERSION} from '../src/tradeSetup2DealingRange.js';
const at=Date.parse('2026-10-15T08:00:00Z')/1000,iso=value=>new Date(value*1000).toISOString(),run='live-watcher:2026-10';
const row=(id,minute,options={})=>({id,snapshot_id:id,instrument:'EURUSD',setup_key:'EURUSD:setup1:19982',known_at:iso(at+minute*60),evaluated_through:iso(at+3600),captured_at:iso(at+3600+minute),configuration_id:'config',evaluation_mode:'live',snapshot:{id,knownAt:at+minute*60,setupKey:'EURUSD:setup1:19982',instrument:'EURUSD',direction:'short',dealingRange:{version:DEALING_RANGE_VERSION,status:minute<10?'confirmed':minute<40?'validated':'invalidated'}},observation:{},...options});
function index(row){return {...Object.fromEntries(['id','snapshot_id','instrument','setup_key','known_at','evaluated_through','captured_at','configuration_id','evaluation_mode'].map(key=>[key,row[key]])),direction:row.snapshot.direction,entry_id:row.snapshot.entry?.id??null,dr_status:row.snapshot.dealingRange?.status??null,dr_version:row.snapshot.dealingRange?.version??null,has_observation:Object.values(row.observation).some(value=>value!=null),has_history:row.observation.checklistHistory!=null};}
it('preserves the complete DR/entry/source/checkpoint view while loading only required originals',()=>{
 const rows=Array.from({length:50},(_,i)=>row('stand:'+i,i));
 for(const minute of [14,28]){const entry=row('entry:'+minute,minute);entry.snapshot.entry={id:entry.snapshot.id,recognizedAt:entry.snapshot.knownAt,price:1.12,entryCategory:'risky'};rows.push(entry);}
 rows[35].observation={checklistHistory:{version:'saved-history',stages:[{at:at+60}]}};
 rows[49].observation={coverage:{from:at,through:at+3600},priceObservation:{evaluatedThrough:at+3600}};
 const extra=structuredClone(rows[14]);extra.id='late-entry-check';extra.configuration_id='other-config';extra.evaluation_mode='catchup';extra.captured_at=iso(at+4000);extra.evaluated_through=iso(at+3900);rows.push(extra);
 const history=structuredClone(rows[35]);history.id='catchup-history';history.evaluation_mode='catchup';history.captured_at=iso(at+4100);history.evaluated_through=iso(at+4000);history.observation.checklistHistory.version='catchup-history';rows.push(history);
 const selected=selectLiveEvidenceIndex(rows.map(index)),ids=new Set(selected.map(row=>row.id));
 expect(selected.length).toBeLessThan(12);
 expect(reviewGroups(liveEvidenceView([],rows.filter(row=>ids.has(row.id)),run))).toEqual(reviewGroups(liveEvidenceView([],rows,run)));
 expect(ids.has('stand:10')).toBe(true);expect(ids.has('stand:35')).toBe(true);expect(ids.has('stand:49')).toBe(true);
 expect(selected.filter(row=>row.entry_id).map(row=>row.entry_id).sort()).toEqual(rows.filter(row=>row.snapshot.entry).map(row=>row.snapshot.entry.id).sort());
});
it('does not mistake an unknown DR version for the first saved validation',()=>{
 const unknown=row('unknown',0);unknown.snapshot.dealingRange={version:'unknown-version',status:'validated'};
 const actual=row('actual',12),later=row('later',20);
 expect(selectLiveEvidenceIndex([unknown,actual,later].map(index)).map(row=>row.id)).toContain('actual');
});
it('keeps the original live row and all source revisions of each selected identity',()=>{
 const live=row('live-row',0),late={...structuredClone(live),id:'late-row',evaluation_mode:'catchup',captured_at:iso(at+3700)};
 expect(selectLiveEvidenceIndex([late,live].map(index)).map(row=>row.id)).toEqual(['late-row','live-row']);
});
