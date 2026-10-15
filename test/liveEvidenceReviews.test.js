import {it,expect} from 'vitest';
import {createSSRApp} from 'vue';
import {renderToString} from 'vue/server-renderer';
import LiveEvidenceReviews from '../src/components/LiveEvidenceReviews.vue';
it('shows a later source once with its own capture time and existing checkpoint details',async()=>{
 const review={id:'entry',setupKey:'dr',runId:'live-watcher:2026-10',instrument:'EURUSD',direction:'short',knownAt:1791879780,entry:{id:'entry',recognizedAt:1791879780,price:1.12},
  evaluationMode:'catchup',evidenceRecordId:'later-source',evidenceCapturedAt:'2026-10-15T08:00:00Z',evidenceEvaluatedThrough:'2026-10-13T08:23:00Z'};
 const primary={additionalChecks:[review]},html=await renderToString(createSSRApp(LiveEvidenceReviews,{snapshots:[primary,primary]}));
 expect(html).toContain('Weitere gespeicherte Prüfbelege (1)');expect(html).toContain('Nachträglicher Prüfstand');expect(html).toContain('2026-10-15 10:00');expect(html).toContain('feature-chips');
});
