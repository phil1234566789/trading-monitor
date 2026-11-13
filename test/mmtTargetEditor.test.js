import {afterEach,describe,it,expect,vi} from 'vitest';
import {createRenderer,h,nextTick,reactive,ssrContextKey} from 'vue';
import Editor from '../src/components/MmtTargetEditor.vue';
import {moveTargetDraft} from '../src/mmtTargetDrafts.js';
const renderer=createRenderer({createElement:tag=>({tag,children:[],props:{}}),createText:text=>({text}),createComment:()=>({}),setText:(n,t)=>n.text=t,setElementText:(n,t)=>n.text=t,patchProp:(n,k,o,v)=>n.props[k]=v,insert:(n,p)=>p.children.push(n),remove:()=>{},parentNode:()=>null,nextSibling:()=>null});
let app;afterEach(()=>{app?.unmount();vi.unstubAllGlobals();});
const order={id:'e297afbf-172c-4304-99e7-eb1198191050',status:'executed',intent:{symbol:'XAUUSD.gbe',direction:'long',stop_loss:1990,account_login:42,account_server:'Demo'},result:{price:2000,volume:.01,position:123}};
const snapshot={account_login:42,account_server:'Demo',target_plans_ready:true,execution_ready:true,trade_allowed:true,positions:[{ticket:123,symbol:'XAUUSD.gbe',type:0,volume:.01,sl:1990,tp:2010}],quotes:[{symbol:'XAUUSD.gbe',minimum_volume:.01,volume_step:.01,maximum_volume:100,bid:2001,ask:2001.1,point:.01,stops_level:.01,digits:2,time:Date.now()/1000}]};
async function mount(){
 vi.stubGlobal('document',{visibilityState:'visible'});
 const api=vi.fn().mockImplementation(async(action,body)=>action==='target_state'?{plan:null}:{plan:{revision:body.revision,state:'pending',next_index:0,plan:{targets:body.targets}}});
 const current=reactive(structuredClone(snapshot));
 app=renderer.createApp({...Editor,render:()=>h('div')},{order,api,snapshot:current,online:true,entryTime:100});
 app.provide(ssrContextKey,{});
 const vm=app.mount({children:[]});await nextTick();await nextTick();return {state:vm.$.setupState,api,snapshot:current};
}
describe('TP edits require Save',()=>{
 it('uses the current open volume even while percentage drafts are dirty',async()=>{
  const {state,api,snapshot:current}=await mount();state.update(0,'percent',50);state.add();state.update(1,'percent',50);await nextTick();
  current.positions[0].volume=.04;await nextTick();
  expect(state.draft.positionVolume).toBe(.04);expect(state.allocation.targets.map(t=>t.volume)).toEqual([.02,.02]);
  expect(api.mock.calls.map(x=>x[0])).toEqual(['target_state']);
 });
 it('does not send after drag, rounds to broker digits, and saves the exact explicit allocation',async()=>{
  const {state,api}=await mount();moveTargetDraft(order.id,0,2012.345);await nextTick();
  expect(api.mock.calls.map(x=>x[0])).toEqual(['target_state']);expect(state.draft.targets[0].price).toBe(2012.35);
  await state.save();expect(api.mock.calls[1][0]).toBe('target_save');expect(api.mock.calls[1][1]).toMatchObject({order_id:order.id,targets:[{price:2012.35,volume:.01}],observed:{volume:.01,sl:1990,tp:2010}});
 });
 it('blocks a 50/50 split at minimum lot and leaves its rounding remainder visible',async()=>{
  const {state,api}=await mount();state.update(0,'percent',50);state.add();state.update(1,'price',2020);state.update(1,'percent',50);await nextTick();
  expect(state.allocation.remainder).toBe(.01);expect(state.validation.error).toBe('invalid_target_volume');await state.save();
  expect(api.mock.calls.map(x=>x[0])).toEqual(['target_state']);
 });
 it('adds a directly draggable clone with a free quantity and never exceeds five drafts',async()=>{
  const {state,api}=await mount();state.add();await nextTick();
  expect(state.draft.targets[1]).toMatchObject({price:2010,volume:''});expect(state.draft.selectedIndex).toBe(1);
  for(let n=0;n<10;n++)state.add();expect(state.draft.targets).toHaveLength(5);
  expect(api).toHaveBeenCalledTimes(1);
 });
 it('discard restores broker targets without sending',async()=>{
  const {state,api}=await mount();moveTargetDraft(order.id,0,2050);state.reset();await nextTick();
  expect(state.draft.targets[0].price).toBe(2010);expect(state.draft.dirty).toBe(false);expect(api).toHaveBeenCalledTimes(1);
 });
});
