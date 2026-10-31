import {describe,it,expect,vi} from 'vitest';
import {effectScope,nextTick,ref} from 'vue';
import {useTradeIdeaDrawing} from '../src/composables/useTradeIdeaDrawing.js';
import {chartMode} from '../src/chartModes.js';
describe('chart idea drawing',()=>{
 it('persists an optional-target idea exactly once without an execution request',async()=>{
  const scope=effectScope(),save=vi.fn().mockResolvedValue({id:1}),refresh=vi.fn();let tool;
  scope.run(()=>{tool=useTradeIdeaDrawing({pointAt:(x,y)=>({time:x,price:y}),save,refresh});});
  chartMode.value='idea-long';await nextTick();
  tool.click({point:{x:100,y:10}});tool.click({point:{x:110,y:9}});
  await tool.finish();
  expect(save).toHaveBeenCalledTimes(1);
  expect(save.mock.calls[0][0].annotations[0].tradeIdea).toMatchObject({direction:'long',entry:10,sl:9,tp:null});
  expect(chartMode.value).toBe('navigate');scope.stop();
 });
 it('keeps a failed save editable and resets when chart context changes',async()=>{
  const scope=effectScope(),context=ref('GBPUSD');let tool;
  scope.run(()=>{tool=useTradeIdeaDrawing({pointAt:(x,y)=>({time:x,price:y}),save:async()=>null,refresh:()=>{},context:()=>context.value});});
  chartMode.value='idea-short';await nextTick();
  tool.click({point:{x:100,y:10}});tool.click({point:{x:110,y:11}});await tool.finish();
  expect(tool.error.value).toContain('nicht gespeichert');expect(tool.points.value).toHaveLength(2);
  context.value='XAUUSD';await nextTick();expect(tool.points.value).toEqual([]);scope.stop();chartMode.value='navigate';
 });
});
