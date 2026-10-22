import {describe,it,expect} from 'vitest';
import {setup1ChecklistDetails,setup1ChecklistRows} from '../src/setup1ChecklistDetails.js';
import {checklistPresentation} from '../src/tradeSetupChecklistPresentation.js';
import {setupEntryConditions} from '../src/tradeSetup2Review.js';
const at=Date.parse('2026-10-07T09:53:00+02:00')/1000;
const state=()=>({model:'countertrend',instrument:'GBPUSD',status:'ready',evaluatedAt:at,checks:{liquiditySweep:{status:'passed'},reaction:{status:'passed'}},setup:{primary:{recognizedAt:at-60,reactionRecognizedAt:at-60,sweep:{timeframe:'5M',level:{dir:-1,price:1.32433,pivotTime:at-86400,touchedTime:at-3600}},reactionOB:{dir:1,bottom:1.32407,top:1.32473,startTime:at-600}}}});
describe('original setup 1 checklist identity',()=>{
 it('identifies the source level, separate pivot/sweep times and original OB without mutation',()=>{
  const s=state(),before=structuredClone(s),details=setup1ChecklistDetails(s);
  expect(details.liquiditySweep.join(' ')).toContain('M5 Liquidity Low · Level 1,32433');
  expect(details.liquiditySweep).toContain('Pivot-/Levelzeit: 2026-10-06 09:53 Uhr (Europe/Berlin)');
  expect(details.liquiditySweep).toContain('Sweepkerze (M5): 2026-10-07 08:53 Uhr (Europe/Berlin)');
  expect(details.reaction.join(' ')).toContain('1,32407–1,32473');
  expect(details.reaction.join(' ')).toContain('2026-10-07 09:43');expect(s).toEqual(before);
 });
 it('shares details between live presentation and saved statistics review',()=>{
  const s=state();const d=setup1ChecklistDetails(s);
  expect(checklistPresentation(s).reaction.details).toEqual(d.reaction);
  const rows=setupEntryConditions({knownAt:at,instrument:'GBPUSD',checklist:s}).rows;
  expect(rows.find(r=>r.key==='liquiditySweep').details).toEqual(d.liquiditySweep);
  expect(rows.find(r=>r.key==='reaction').details).toEqual(d.reaction);
 });
 it('keeps missing original values explicit and never substitutes the retest OB',()=>{
  const s=state();s.setup.primary={recognizedAt:at-60};s.entry={retest:{ob:{bottom:9,top:10}}};
  const d=setup1ChecklistDetails(s);expect(d.reaction.join(' ')).toContain('nicht gespeichert');expect(d.reaction.join(' ')).not.toContain('9');
  expect(d.liquiditySweep.join(' ')).toContain('nicht gespeichert');
 });
 it('uses the saved precise sweep only when its source matches the original level',()=>{
  const s=state(),m1={structureStart:{sourceTime:at-3600,price:1.32433,structureFrom:at-3480,recognizedAt:at-3420}};
  expect(setup1ChecklistDetails(s,m1).liquiditySweep.join(' ')).toContain('Tatsächlicher Sweep (M1): 2026-10-07 08:55');
  m1.structureStart.price=1.4;expect(setup1ChecklistDetails(s,m1).liquiditySweep.join(' ')).toContain('Genauere Sweepzeit: nicht gespeichert');
 });
 it('does not promote an H1 sweep refined on M5 candles to an exact M1 timestamp',()=>{
  const s=state();s.setup.primary.sweep.timeframe='1H';s.setup.primary.sweep.level.fineTouchedTime=at-3300;
  const details=setup1ChecklistDetails(s).liquiditySweep.join(' ');
  expect(details).toContain('H1 Liquidity Low');expect(details).toContain('Sweepkerze (M5): 2026-10-07 08:58');
  expect(details).toContain('Genauere Sweepzeit: nicht gespeichert');expect(details).not.toContain('Sweep (M1)');
 });
 it('keeps replay row status and other evidence unchanged while enriching A/B',()=>{
  const rows=[{key:'liquiditySweep',status:'passed',details:['generic']},{key:'targets',status:'unknown',details:['original']}];
  const enriched=setup1ChecklistRows(rows,state());
  expect(enriched[0].status).toBe('passed');expect(enriched[0].details.join(' ')).toContain('1,32433');
  expect(enriched[1]).toBe(rows[1]);expect(rows[0].details).toEqual(['generic']);
 });
 it('does not reveal future facts or change other checklist models',()=>{
  const s=state();s.setup.primary.recognizedAt=at+60;expect(setup1ChecklistDetails(s)).toEqual({});
  s.model='legacy';expect(setup1ChecklistDetails(s)).toEqual({});
 });
});
