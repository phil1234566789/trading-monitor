import { it,expect } from 'vitest';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import SimulationFeatureChips from '../src/components/SimulationFeatureChips.vue';
it('renders a new registry entry as a chip and details without component changes',async()=>{
  const features=[{key:'dummy',group:'checkpoint',label:'I · Dummy checkpoint',value:'observed',details:['Dummy evidence']}];
  const html=await renderToString(createSSRApp(SimulationFeatureChips,{features,selectedKey:'dummy'}));
  expect(html).toContain('I · Dummy checkpoint');expect(html).toContain('Dummy evidence');expect(html).toContain('~');expect(html).toContain('aria-expanded="true"');
});
