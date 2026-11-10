import {effectScope,nextTick,ref} from 'vue';
import {expect,it,vi} from 'vitest';
import {watchM1FvgPreviewContext} from '../src/composables/useM1FvgPreviewContext.js';
it('preserves arming and successful disarm preview; clears context switches, rewind and other chart actions',async()=>{
 const scope=effectScope(),disarm=vi.fn();
 const state={preview:ref(null),message:ref(''),editingTradeId:ref(151),symbol:ref('XAUUSD'),bar:ref('1m'),replayUntil:ref(1000),armed:ref(null),selection:ref(null),disarm};
 scope.run(()=>watchM1FvgPreviewContext(state));
 state.armed.value={key:'entryFvgRetestReaction'};state.selection.value={id:151};await nextTick();
 expect(disarm).not.toHaveBeenCalled();
 state.armed.value=null;state.selection.value=null;state.preview.value={status:'ready',entryTime:1000};await nextTick();
 expect(state.preview.value).toMatchObject({status:'ready'});
 for(const [key,value] of [['replayUntil',500],['editingTradeId',152],['symbol','GBPUSD'],['bar','5m']]){
  state.preview.value={status:'ready'};state.message.value='preview';state[key].value=value;await nextTick();
  expect(state.preview.value).toBeNull();expect(state.message.value).toBe('');
 }
 state.preview.value={status:'ready'};state.armed.value={key:'target'};await nextTick();expect(state.preview.value).toBeNull();
 scope.stop();
});
