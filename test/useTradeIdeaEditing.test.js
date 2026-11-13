import {afterEach,it,expect,vi} from 'vitest';
import {effectScope,ref} from 'vue';
import {useTradeIdeaEditing} from '../src/composables/useTradeIdeaEditing.js';
import {makeTradeIdea} from '../src/tradeIdeas.js';
import {chartMode} from '../src/chartModes.js';
let scope;
afterEach(()=>{scope?.stop();vi.unstubAllGlobals();});
function fixture(saveResult=true){
 const handlers={};vi.stubGlobal('document',{addEventListener:(key,fn)=>handlers[key]=fn,removeEventListener:vi.fn()});
 const row={id:'existing',visible:true,annotations:makeTradeIdea('long',{time:100,price:10},{time:160,price:9},{time:220,price:12}).annotations};
 const store={drawings:ref([row]),updateAnnotation:vi.fn().mockResolvedValue(saveResult)};
 const original=store.drawings.value[0].annotations[0];
 const refresh=vi.fn(),chart={options:()=>({handleScroll:{mouseWheel:true}}),applyOptions:vi.fn()};
 scope=effectScope();const editor=scope.run(()=>useTradeIdeaEditing({store,pointAt:(x,y)=>({time:x,price:y}),refresh}));
 chartMode.value='navigate';
 editor.create(chart,{getBoundingClientRect:()=>({left:0,top:0}),addEventListener:(key,fn)=>handlers[key]=fn,removeEventListener:vi.fn()});
 editor.setLines([{primitive:{distanceTo:()=>0},annotation:original,level:'sl'}]);
 const event={button:0,target:{tagName:'CANVAS'},clientX:160,clientY:9,preventDefault:vi.fn(),stopImmediatePropagation:vi.fn()};
 return {handlers,editor,store,original,chart,event};
}
it('previews a drag, updates the existing row once on release and restores navigation',async()=>{
 const {handlers,editor,store,original,chart,event}=fixture();
 handlers.pointerdown(event);handlers.pointermove({...event,clientY:8});
 expect(editor.annotations([original])[0].tradeIdea.sl).toBe(8);
 expect(original.tradeIdea.sl).toBe(9);expect(store.updateAnnotation).not.toHaveBeenCalled();
 await handlers.pointerup(event);
 expect(store.updateAnnotation).toHaveBeenCalledExactlyOnceWith('existing',0,expect.objectContaining({tradeIdea:expect.objectContaining({sl:8})}));
 expect(chart.applyOptions).toHaveBeenLastCalledWith({handleScroll:{mouseWheel:true}});
 expect(editor.status.value).toBe('Idee gespeichert');
});
it('cancels without saving and rolls back a failed save',async()=>{
 const {handlers,editor,store,original,event}=fixture(false);
 handlers.pointerdown(event);handlers.pointermove({...event,clientY:8});handlers.keydown({key:'Escape'});
 await handlers.pointerup(event);expect(store.updateAnnotation).not.toHaveBeenCalled();
 expect(editor.annotations([original])[0]).toBe(original);
 handlers.pointerdown(event);handlers.pointermove({...event,clientY:8});await handlers.pointerup(event);
 expect(editor.status.value).toContain('fehlgeschlagen');expect(editor.annotations([original])[0]).toBe(original);
});
it('does not edit overlapping ideas or drawings from another tool mode',()=>{
 const {handlers,editor,store,original,event,chart}=fixture();
 chartMode.value='measure';handlers.pointerdown(event);expect(chart.applyOptions).not.toHaveBeenCalled();
 chartMode.value='navigate';editor.setLines([1,2].map(()=>({primitive:{distanceTo:()=>0},annotation:original,level:'sl'})));
 handlers.pointerdown(event);expect(chart.applyOptions).not.toHaveBeenCalled();expect(store.updateAnnotation).not.toHaveBeenCalled();
});
