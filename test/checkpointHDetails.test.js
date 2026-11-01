import {expect,it} from 'vitest';
import {createSSRApp} from 'vue';
import {renderToString} from 'vue/server-renderer';
import CheckpointHDetails from '../src/components/CheckpointHDetails.vue';
import SimulationFeatureChips from '../src/components/SimulationFeatureChips.vue';
import ChecklistReplayHistory from '../src/components/ChecklistReplayHistory.vue';
import original from './fixtures/checkpointH3033.json';
import v10 from './fixtures/checkpointH22681.json';
const render=(component,props)=>renderToString(createSSRApp(component,props));
it('shows versioned rules first and the decision last without duplicate positive evidence',async()=>{
 const html=await render(CheckpointHDetails,{snapshot:v10});
 expect(html).toContain('Prüfung 2026-10-20 13:04 Uhr');expect(html).toContain('historische Regeln v10');
 expect(html).toContain('M5-BOS war unter v10 optional');expect(html).toContain('Optional · Nicht erfüllt');
 expect(html).toContain('Pflicht · Nicht erfüllt');expect(html).toContain('Pflicht · Erfüllt');expect(html).toContain('Nicht beurteilbar');
 expect(html.indexOf('Kein Entry:')).toBeGreaterThan(html.indexOf('Gleichgerichtete M1-FVG'));
 expect(html).not.toContain('positive Einzelbelege');expect(html).not.toContain('primary-cause');
 expect(html).toContain('class="negative"');expect(html).toContain('class="warning"');expect(html).toContain('class="positive"');
});
it('uses exactly the same candidate rules in statistics and chart history',async()=>{
 const feature={key:'entry',group:'checkpoint',label:'H · Entry finden',value:'unknown'};
 const stats=await render(SimulationFeatureChips,{snapshot:original,features:[feature],selectedKey:'entry'});
 const chart=await render(ChecklistReplayHistory,{history:original.checklistHistory,asOf:original.knownAt,checklistState:original.checklist});
 for(const html of [stats,chart]){expect(html).toContain('Kein Entry: Pflichtregel M5-BOS');expect(html).toContain('2026-08-27 22:59');expect(html).toContain('historische Regeln v11');}
});
