import {it,expect} from 'vitest';
import {createSSRApp} from 'vue';
import {renderToString} from 'vue/server-renderer';
import LiveEvidenceProvenance from '../src/components/LiveEvidenceProvenance.vue';
it('shows original capture and later as-of times in Berlin with partial coverage visibly separate',async()=>{
 const snapshot={evidenceRecordId:'source',evaluationMode:'catchup',evidenceCapturedAt:'2026-10-15T06:00:00Z',evidenceEvaluatedThrough:'2026-10-13T08:23:00Z',
 observationCapturedAt:'2026-10-15T06:01:00Z',liveObservedThrough:Date.parse('2026-10-13T08:24:00Z')/1000,liveCoverage:{missingBeforeCapture:true},priceObservation:{stage1:'target1',stage2:'target2'}};
 const html=await renderToString(createSSRApp(LiveEvidenceProvenance,{snapshot}));
 expect(html).toContain('Nachträglich erkannt');expect(html).toContain('2026-10-15 08:00');expect(html).toContain('2026-10-13 10:23');expect(html).toContain('2026-10-13 10:24');expect(html).toContain('T1 beobachtet');expect(html).toContain('T2 beobachtet');expect(html).toContain('nicht belegt');
 expect(html).not.toContain('Original-Liveprüfung');
});

it('labels the later observation on a pin without changing its original source time',async()=>{
 const source={recordId:'original',evaluationMode:'live',capturedAt:'2026-10-13T08:23:00Z',evaluatedThrough:'2026-10-13T08:23:00Z'};
 const observation={recordId:'later',capturedAt:'2026-10-15T06:00:00Z',evaluatedThrough:'2026-10-13T10:23:00Z'};
 const html=await renderToString(createSSRApp(LiveEvidenceProvenance,{source,observation}));
 expect(html).toContain('2026-10-13 10:23');expect(html).toContain('2026-10-15 08:00');expect(html).toContain('2026-10-13 12:23');
});
