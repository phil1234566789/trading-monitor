import {expect,it} from 'vitest';
import original from './fixtures/checkpointH3033.json';
import {checkpointHExplanation} from '../src/checkpointHExplanation.js';
const copy=()=>structuredClone(original);
it('uses the real saved M1 history instead of inventing missing signals from the empty summary',()=>{
  const result=checkpointHExplanation(copy());
  expect(result.sourceAt).toBe(1787864340);
  expect(result.summary).toContain('M5-BOS');
  expect(result.rows.find(r=>r.key==='m5Bos').state).toBe('missing');
  for(const key of ['m1PivotBreak','retest','fvg'])expect(result.rows.find(r=>r.key===key).state).toBe('fulfilled');
  expect(result.rows.find(r=>r.key==='active')).toMatchObject({state:'uncertain'});
  expect(JSON.stringify(result)).not.toContain('nach T1 oder Lifecycle-Ende beendet');
});
it('does not turn absent historical checks into unmet requirements or technical errors',()=>{
  const s=copy();delete s.checklistHistory;
  const result=checkpointHExplanation(s);
  expect(result.rows.filter(r=>r.state==='missing')).toEqual([]);
  expect(result.rows.find(r=>r.key==='m5Bos').state).toBe('notStored');
  expect(result.state).toBe('uncertain');
});
it('keeps a later lifecycle end separate from the earlier missing M5 BOS',()=>{
  const s=copy(),last=s.checklistHistory.entries.at(-1);
  last.checklist.setup.primary.lifecycle={main:{state:'ended',reason:'target1',recognizedAt:last.knownAt},entrySearchAllowed:false};
  const result=checkpointHExplanation(s);
  expect(result.summary).toContain('M5-BOS');
  expect(result.rows.find(r=>r.key==='active').state).toBe('blocked');
  expect(result.context).toContain('keine Erklärung für frühere');
});
it('labels absent checks after a proven end as not checked, not as failed',()=>{
  const s=copy();delete s.checklistHistory;
  s.checklist.setup.primary.lifecycle={main:{state:'ended',reason:'target1',recognizedAt:s.knownAt},entrySearchAllowed:false};
  const result=checkpointHExplanation(s);
  expect(result.rows.find(r=>r.key==='retest').state).toBe('notChecked');
  expect(result.summary).toContain('Suchphase beendet');
});
it('names only an explicitly stored technical failure as a technical failure',()=>{
  const s=copy();delete s.checklistHistory;s.m1Check={evaluatedAt:s.knownAt,status:'error',details:['Worker abgebrochen']};
  const result=checkpointHExplanation(s);
  expect(result.state).toBe('technical');expect(result.summary).toContain('Technischer Fehler');
  expect(result.context).toContain('Worker abgebrochen');
});
it('never uses a future saved M1 test or a future entry when rewinding',()=>{
  const s=copy();s.entry={recognizedAt:s.knownAt+60,price:999};
  const result=checkpointHExplanation(s,1787864000);
  expect(result.rows.filter(r=>r.state==='missing')).toEqual([]);
  expect(result.sourceAt).toBeNull();expect(JSON.stringify(result)).not.toContain('999');
});
it('does not treat an omitted condition key as an evaluated missing signal',()=>{
  const s=copy();for(const h of s.checklistHistory.entries)delete h.m1Check.conditions.m5Bos;
  const result=checkpointHExplanation(s);
  expect(result.rows.find(r=>r.key==='m5Bos').state).toBe('notStored');
  expect(result.rows.filter(r=>r.state==='missing')).toEqual([]);
});
it('keeps an explicit later technical error visible even when an earlier history exists',()=>{
  const s=copy();s.checklist.status='error';s.checklist.details=['Auswertung fehlgeschlagen'];
  expect(checkpointHExplanation(s)).toMatchObject({state:'technical',context:'Auswertung fehlgeschlagen'});
});
it('accepts a newer saved M1 summary even when unchanged history was last recorded earlier',()=>{
  const s=copy();s.m1Check={...s.checklistHistory.entries[0].m1Check,evaluatedAt:s.knownAt};
  const result=checkpointHExplanation(s);
  expect(result.sourceAt).toBe(s.knownAt);
  expect(result.rows.find(r=>r.key==='m5Bos').state).toBe('missing');
});
it('distinguishes an explicitly pending calculation from missing signals',()=>{
  const s=copy();delete s.checklistHistory;s.m1Check={evaluatedAt:s.knownAt,status:'unknown',reason:'loading'};
  const result=checkpointHExplanation(s);
  expect(result.state).toBe('waiting');expect(result.rows.find(r=>r.key==='retest').state).toBe('waiting');
});
it('labels a saved disabled check as not checked rather than as missing data',()=>{
  const s=copy();delete s.checklistHistory;s.m1Check={evaluatedAt:s.knownAt,status:'pending',reason:'disabled',details:['M1-Struktur ausgeschaltet.']};
  const result=checkpointHExplanation(s);
  expect(result.state).toBe('notChecked');expect(result.rows.find(r=>r.key==='retest').state).toBe('notChecked');
});
