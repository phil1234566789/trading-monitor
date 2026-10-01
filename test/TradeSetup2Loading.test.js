import { expect, it } from 'vitest';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import TradeSetup2Loading from '../src/components/TradeSetup2Loading.vue';

it('reports completed steps, disappears on completion, and exposes a retry on failure', async () => {
  const render=(steps,error)=>renderToString(createSSRApp(TradeSetup2Loading,{steps,error}));
  const steps=[{label:'Entry',done:true},{label:'Kerzen',done:false},{label:'Zeichnen',done:false}];
  expect(await render(steps)).toContain('value="1" max="3"');
  expect(await render(steps)).toContain('1 von 3 Schritten');
  expect(await render(steps.map(step=>({...step,done:true})))).not.toContain('<progress');
  const error=await render(steps,'Netzwerkfehler');
  expect(error).toContain('role="alert"');expect(error).toContain('Erneut versuchen');
});
