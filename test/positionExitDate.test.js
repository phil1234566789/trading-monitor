import {effectScope,ref} from 'vue';
import {afterEach,expect,it} from 'vitest';
import {usePositionExitDate} from '../src/composables/usePositionExitDate.js';
import {berlinDatetimeInput,parseBerlinDatetimeInput} from '../src/berlinTime.js';
let scope;
afterEach(()=>scope?.stop());
function setup(entry='2026-11-05T20:56',exit=''){
 const entryTime=ref(entry),exitTime=ref(exit);scope=effectScope();
 return {entryTime,exitTime,...scope.run(()=>usePositionExitDate(entryTime,exitTime))};
}
it('defaults only the entry calendar day and follows it until the date or clock is manually used',()=>{
 const form=setup();expect(form.exitDateInput.value).toBe('2026-11-05');expect(form.exitClockInput.value).toBe('');expect(form.exitTime.value).toBe('');
 form.entryTime.value='2026-11-06T01:00';expect(form.exitDateInput.value).toBe('2026-11-06');expect(form.exitTime.value).toBe('');
 form.exitDateInput.value='2026-11-07';form.entryTime.value='2026-11-08T01:00';expect(form.exitDateInput.value).toBe('2026-11-07');
 form.exitClockInput.value='03:15';expect(form.exitTime.value).toBe('2026-11-07T03:15');
 form.entryTime.value='2026-11-09T10:00';expect(form.exitTime.value).toBe('2026-11-07T03:15');
});
it('preserves saved exits and supports clearing the clock without inventing midnight',()=>{
 const form=setup('2026-10-24T23:30','2026-10-25T02:30');
 form.entryTime.value='2026-10-26T09:00';expect(form.exitTime.value).toBe('2026-10-25T02:30');
 form.exitClockInput.value='';expect(form.exitTime.value).toBe('');
});
it('uses Berlin dates independent of browser timezone and handles DST gaps and repeated times',()=>{
 expect(berlinDatetimeInput(Date.parse('2026-07-01T22:30:00Z')/1000)).toBe('2026-07-02T00:30');
 expect(parseBerlinDatetimeInput('2026-07-02T00:30')).toBe(Date.parse('2026-07-01T22:30:00Z')/1000);
 expect(parseBerlinDatetimeInput('2026-03-29T02:30')).toBeNaN();
 const second=Date.parse('2026-10-25T01:30:17Z')/1000;
 expect(parseBerlinDatetimeInput('2026-10-25T02:30',second)).toBe(second);
 expect(parseBerlinDatetimeInput('2026-10-25T02:30')).toBe(Date.parse('2026-10-25T00:30:00Z')/1000);
 expect(parseBerlinDatetimeInput('2026-02-30T12:00')).toBeNaN();
});
