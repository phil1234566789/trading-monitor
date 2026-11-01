import {expect,it} from 'vitest';
import original from './fixtures/checkpointH22681.json';
import dr3033 from './fixtures/checkpointH3033.json';
import {checkpointHExplanation} from '../src/checkpointHExplanation.js';
it('explains why the original FVG could not trigger an entry before the much later pivot break',()=>{
  const result=checkpointHExplanation(structuredClone(original));
  expect(result.summary).toContain('13:04');expect(result.summary).toContain('14:07');
  expect(result.summary).toContain('M1-Pivotbruch');expect(result.summary).not.toContain('Suchphase beendet');
  expect(result.causality.candidateAt).toBe(1792494240);
  expect(result.causality.proof.join(' ')).toContain('keine spätere FVG-Bestätigung gespeichert');
  expect(result.summary).not.toContain('M5-BOS');
});
it('does not reveal the later pivot break when rewound to the FVG candidate',()=>{
  const result=checkpointHExplanation(structuredClone(original),1792494240);
  expect(result.summary).toContain('13:04');expect(result.summary).toContain('M1-Pivotbruch');
  expect(result.summary).not.toContain('14:07');
});
it('does not declare the later green individual facts a valid simultaneous pattern',()=>{
  const s=structuredClone(original);
  const latest=s.checklistHistory.entries.at(-1);
  s.checklistHistory.entries=[latest];
  const result=checkpointHExplanation(s);
  expect(result.state).toBe('uncertain');
  expect(result.summary).toContain('Grund mit gespeicherten Daten nicht feststellbar');
  expect(result.causality.proof.join(' ')).toContain('Prüfung zum FVG-Zeitpunkt');
});
it('keeps a fresh later FVG with insufficient release evidence unknown instead of blaming the earlier late break',()=>{
  const s=structuredClone(original),latest=s.checklistHistory.entries.at(-1);
  const next=structuredClone(s.checklistHistory.entries.at(-2));
  next.m1Check.evaluatedAt=1792498500;next.knownAt=1792498500;
  next.m1Check.conditions.fvg.recognizedAt=1792498500;next.m1Check.fvg=next.m1Check.conditions.fvg;
  s.checklistHistory.entries.splice(-1,0,next);
  const result=checkpointHExplanation(s);
  expect(result.state).toBe('uncertain');expect(result.summary).toContain('Grund mit gespeicherten Daten nicht feststellbar');
});
it('still explains DR3033 using the required missing M5 BOS at its actual FVG candidate time',()=>{
  const result=checkpointHExplanation(structuredClone(dr3033));
  expect(result.summary).toContain('M5-BOS');expect(result.summary).toContain('22:59');
  expect(result.causality.candidateAt).toBe(1787864340);
});
it('keeps the proven candidate cause ahead of a later technical failure',()=>{
  const s=structuredClone(original);s.checklist.status='error';s.checklist.details=['Spätere Auswertung abgebrochen'];
  const result=checkpointHExplanation(s);
  expect(result.summary).toContain('13:04');expect(result.summary).toContain('14:07');
  expect(result.state).toBe('missing');expect(result.technicalNote).toContain('Spätere Auswertung abgebrochen');
});
it('names an explicit gate block stored at the candidate time, without recomputing schedules',()=>{
  const s=structuredClone(original);s.checklistHistory.entries[1].entryEligibility={status:'blocked',details:['Session am Kandidatenzeitpunkt gesperrt.']};
  const result=checkpointHExplanation(s);
  expect(result.state).toBe('blocked');expect(result.summary).toContain('13:04');
  expect(result.causality.proof).toContain('Session am Kandidatenzeitpunkt gesperrt.');
});
it('keeps a technical failure in the candidate test distinct from absent pattern signals',()=>{
  const s=structuredClone(original);s.checklistHistory.entries[1].m1Check.status='error';
  const result=checkpointHExplanation(s);
  expect(result.state).toBe('technical');expect(result.summary).toContain('13:04');
});
it('does not substitute a later error for a missing original candidate test',()=>{
  const s=structuredClone(original);s.checklistHistory.entries=[s.checklistHistory.entries.at(-1)];
  s.checklist.status='error';s.checklist.details=['Späterer Fehler'];
  const result=checkpointHExplanation(s);
  expect(result.state).toBe('uncertain');expect(result.summary).toContain('Grund mit gespeicherten Daten nicht feststellbar');
  expect(result.technicalNote).toContain('Späterer Fehler');
});
