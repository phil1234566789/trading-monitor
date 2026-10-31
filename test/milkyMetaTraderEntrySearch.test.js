import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRenderer, createSSRApp, h, nextTick, reactive, ssrContextKey } from 'vue';
import { renderToString } from '@vue/server-renderer';
import EntrySearch from '../src/components/MilkyMetaTraderEntrySearch.vue';
const { route }=vi.hoisted(()=>({route:{}}));
vi.mock('vue-router',()=>({useRoute:()=>route}));
const renderer=createRenderer({
  createElement:tag=>({tag,children:[],props:{}}),createText:text=>({text}),createComment:()=>({}),
  setText:(node,text)=>{node.text=text;},setElementText:(node,text)=>{node.text=text;},
  patchProp:(node,key,old,value)=>{node.props[key]=value;},
  insert:(node,parent)=>{parent.children.push(node);},remove:()=>{},parentNode:()=>null,nextSibling:()=>null,
});
let app;
afterEach(()=>{app?.unmount();vi.unstubAllGlobals();});
function mount(query={}) {
  vi.stubGlobal('sessionStorage',{getItem:()=>null,removeItem:vi.fn()});
  route.query=reactive(query);
  const api=vi.fn().mockImplementation(async(action,{order})=>({preview:{intent:order,risk:1,confirmation_expires_sec:Date.now()/1000+30},confirmation:'signed'}));
  app=renderer.createApp({...EntrySearch,render:()=>h('div')},{api,status:{online:true},account:{id:'demo',mode:'demo'}});
  app.provide(ssrContextKey,{});
  const root={children:[]},vm=app.mount(root);
  return {state:vm.$.setupState,api};
}
describe('MMT optional target form',()=>{
  it('keeps SL required and sends a blank TP as null',async()=>{
    const {state,api}=mount({symbol:'EURUSD.gbe',direction:'long',sl:'1.09'});
    const html=await renderToString(createSSRApp(EntrySearch,{api,status:{online:true},account:{id:'demo'}}));
    expect(html).toMatch(/Stop-Loss<input[^>]*required/);
    expect(html).toMatch(/Take-Profit \(optional\)<input[^>]*placeholder="Kein TP"/);
    expect(html.match(/Take-Profit \(optional\)(<input[^>]*>)/)[1]).not.toContain('required');
    await state.showPreview();
    expect(api.mock.calls[0]).toEqual(['search_preview',{order:{symbol:'EURUSD.gbe',direction:'long',stop_loss:1.09,take_profit:null,duration_sec:600}}]);
    state.tp='1.12';await nextTick();
    expect(state.preview).toBeNull();
    await state.showPreview();
    expect(api.mock.calls[1][1].order.take_profit).toBe(1.12);
    state.tp='';await nextTick();await state.showPreview();
    expect(api.mock.calls[2][1].order.take_profit).toBeNull();
  });
  it('clears a previous URL target when the next prefill omits TP',async()=>{
    const {state}=mount({symbol:'EURUSD.gbe',sl:'1.11',tp:'1.09'});
    expect(state.tp).toBe('1.09');
    delete route.query.tp;await nextTick();
    expect(state.tp).toBe('');
  });
});
