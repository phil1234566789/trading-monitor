import {expect,it} from 'vitest';
import {createSSRApp} from 'vue';
import {renderToString} from 'vue/server-renderer';
import CheckpointHDetails from '../src/components/CheckpointHDetails.vue';
import SimulationFeatureChips from '../src/components/SimulationFeatureChips.vue';
import ChecklistReplayHistory from '../src/components/ChecklistReplayHistory.vue';
import original from './fixtures/checkpointH3033.json';
const render=(component,props)=>renderToString(createSSRApp(component,props));
it('shows a cause first, a precise source time, positive evidence and distinct uncertainty with words and colors',async()=>{
  const html=await render(CheckpointHDetails,{snapshot:original});
  expect(html).toContain('Kein Entry: M5-BOS');expect(html).toContain('2026-08-27 22:59');
  expect(html).toContain('✓ Erfüllt:');expect(html).toContain('Historie fehlt');
  expect(html).toContain('Nicht gespeichert');expect(html).toContain('class="warning"');expect(html).toContain('class="positive"');
  expect(html).toContain('<details');
});
it('uses exactly the same H explanation in statistics and the chart history',async()=>{
  const feature={key:'entry',group:'checkpoint',label:'H · Entry finden',value:'unknown'};
  const stats=await render(SimulationFeatureChips,{snapshot:original,features:[feature],selectedKey:'entry'});
  const chart=await render(ChecklistReplayHistory,{history:original.checklistHistory,asOf:original.knownAt,checklistState:original.checklist});
  for(const html of [stats,chart]){expect(html).toContain('Kein Entry: M5-BOS');expect(html).toContain('2026-08-27 22:59');expect(html).toContain('H · Entry finden');}
});
