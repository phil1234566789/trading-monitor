import {expect,it} from 'vitest';
import original from './fixtures/checkpointH3033.json';
import {checkpointHExplanation} from '../src/checkpointHExplanation.js';
const copy=()=>structuredClone(original);
it('uses exact saved candidate history and keeps lifecycle at that same time',()=>{
 const c=checkpointHExplanation(copy()).candidates[0];
 expect(c.at).toBe(1787864340);expect(c.rows.find(r=>r.key==='m5Bos').state).toBe('missing');
 for(const key of ['active','m1PivotBreak','retest','fvg'])expect(c.rows.find(r=>r.key===key).state).toBe('fulfilled');
});
it('does not invent a candidate when historical checks are absent',()=>{
 const s=copy();delete s.checklistHistory;
 expect(checkpointHExplanation(s).candidates).toEqual([]);
});
it('keeps later technical failure separate from the candidate result',()=>{
 const s=copy();s.checklist.status='error';s.checklist.details=['Worker abgebrochen'];
 const result=checkpointHExplanation(s);expect(result.candidates[0].state).toBe('missing');expect(result.technicalNotes.join(' ')).toContain('Worker abgebrochen');
});
it('never uses a future candidate or future technical failure while rewinding',()=>{
 const s=copy();s.m1Check={status:'error',evaluatedAt:s.knownAt,details:['future failure']};
 const result=checkpointHExplanation(s,1787864000);expect(result.candidates).toEqual([]);expect(result.technicalNotes).toEqual([]);
});
it('keeps an omitted mandatory condition unknown rather than red',()=>{
 const s=copy();for(const f of s.checklistHistory.entries)if(f.m1Check?.conditions)delete f.m1Check.conditions.m5Bos;
 expect(checkpointHExplanation(s).candidates[0].rows.find(r=>r.key==='m5Bos').state).toBe('uncertain');
});
it('keeps actual candidate technical error separate and all signal statuses unknown',()=>{
 const s=copy();const f=s.checklistHistory.entries.find(f=>f.m1Check?.evaluatedAt===1787864340);f.m1Check.status='error';f.m1Check.details=['Failed'];
 const c=checkpointHExplanation(s).candidates[0];expect(c.rows.every(r=>r.state==='uncertain')).toBe(true);expect(c.technicalNote).toContain('Failed');
});
