import {afterEach,describe,it,expect,vi} from 'vitest';
import {createRenderer,h,nextTick,reactive,ssrContextKey} from 'vue';
import {renderToString} from '@vue/server-renderer';
import {createSSRApp} from 'vue';
import Editor from '../src/components/MmtTargetEditor.vue';
import {moveTargetDraft,splitTargetDraft,changeTargetShare,targetDraftLines} from '../src/mmtTargetDrafts.js';
import {saveTargetDraft,targetSaveState,nativeTargetKey} from '../src/mmtTargetSave.js';
const renderer=createRenderer({createElement:tag=>({tag,children:[],props:{}}),createText:text=>({text}),createComment:()=>({}),setText:(n,t)=>n.text=t,setElementText:(n,t)=>n.text=t,patchProp:(n,k,o,v)=>n.props[k]=v,insert:(n,p)=>p.children.push(n),remove:()=>{},parentNode:()=>null,nextSibling:()=>null});
let app;afterEach(()=>{app?.unmount();vi.unstubAllGlobals();vi.restoreAllMocks();});
const order={id:'e297afbf-172c-4304-99e7-eb1198191050',status:'executed',intent:{symbol:'XAUUSD.gbe',direction:'long',stop_loss:1990,account_login:42,account_server:'Demo'},result:{price:2000,volume:.01,position:123}};
const snapshot={account_login:42,account_server:'Demo',target_plans_ready:true,execution_ready:true,trade_allowed:true,positions:[{ticket:123,symbol:'XAUUSD.gbe',type:0,volume:.01,sl:1990,tp:2010}],quotes:[{symbol:'XAUUSD.gbe',minimum_volume:.01,volume_step:.01,maximum_volume:100,bid:2001,ask:2001.1,point:.01,stops_level:.01,digits:2,time:Date.now()/1000}]};
async function mount(extra={}){
 vi.stubGlobal('document',{visibilityState:'visible'});
 const api=extra.api??vi.fn().mockImplementation(async(action,body)=>action==='target_state'?{plan:null}:{plan:{revision:body.revision,state:'pending',next_index:0,plan:{targets:body.targets}}});
 const current=reactive(structuredClone(extra.snapshot??snapshot));
 app=renderer.createApp({...Editor,render:()=>h('div')},{order:extra.nativePosition?undefined:extra.order??order,nativePosition:extra.nativePosition,api,snapshot:current,online:true,entryTime:100});
 app.provide(ssrContextKey,{});
 const vm=app.mount({children:[]});await nextTick();await nextTick();return {state:vm.$.setupState,api,snapshot:current};
}
describe('TP edits require Save',()=>{
 it('does not misclassify a newer worker quote as future data between UI timer ticks',async()=>{
  const {state,snapshot:current}=await mount(),time=state.now+1500;
  vi.spyOn(Date,'now').mockReturnValue(time);current.quotes[0].time=time/1000;await nextTick();
  expect(state.ready).toBe(true);
 });
 it('saves 25/75 through the chart binding using the editor API and restores the saved plan after remount',async()=>{
  let stored=null;
  const api=vi.fn(async(action,body)=>{if(action==='target_state')return {plan:stored};stored={revision:body.revision,state:'pending',next_index:0,plan:{targets:structuredClone(body.targets)}};return {plan:stored};});
  const current=structuredClone(snapshot);current.positions[0].volume=.04;
  const {state}=await mount({api,snapshot:current});splitTargetDraft(order.id,0);changeTargetShare(order.id,0,25);await nextTick();
  expect(targetSaveState(order.id).disabled).toBe(false);await saveTargetDraft(order.id);
  expect(api.mock.calls.filter(c=>c[0]==='target_save')).toHaveLength(1);
  expect(stored.plan.targets.map(t=>t.volume)).toEqual([.01,.03]);
  expect(targetSaveState(order.id).status).toContain('Worker-/Brokerbestätigung steht noch aus');
  stored={...stored,state:'active'};await state.refresh();expect(targetSaveState(order.id).status).toBe('Aktiv');
  app.unmount();expect(await saveTargetDraft(order.id)).toBe(false);
  await mount({api,snapshot:current});expect(targetDraftLines('XAUUSD').map(line=>line.percent)).toEqual([25,75]);
 });
 it('blocks duplicate saves and retains changes made while the request is in flight',async()=>{
  const {state,api}=await mount();moveTargetDraft(order.id,0,2012);
  let resolve;api.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
  const saving=saveTargetDraft(order.id);expect(await saveTargetDraft(order.id)).toBe(false);
  moveTargetDraft(order.id,0,2013);resolve({plan:{revision:'saved',state:'pending',next_index:0,plan:{targets:[{price:2012,volume:.01}]}}});await saving;
  expect(state.draft.targets[0].price).toBe(2013);expect(state.draft.dirty).toBe(true);expect(targetSaveState(order.id).disabled).toBe(true);
 });
 it('exposes an uncertain result without retry',async()=>{
  const {state,api}=await mount();moveTargetDraft(order.id,0,2012);
  api.mockRejectedValueOnce(new Error('network timeout'));await saveTargetDraft(order.id);
  expect(targetSaveState(order.id).status).toBe('Ausgang ungeklärt');expect(await saveTargetDraft(order.id)).toBe(false);
 });
 it('ignores a late save response after unmount without replacing a new editor draft',async()=>{
  const {api}=await mount();moveTargetDraft(order.id,0,2012);
  let resolve;api.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));const saving=saveTargetDraft(order.id);
  app.unmount();const fresh=await mount();moveTargetDraft(order.id,0,2015);
  resolve({plan:{revision:'old',state:'pending',next_index:0,plan:{targets:[{price:2012,volume:.01}]}}});await saving;
  expect(fresh.state.draft.targets[0].price).toBe(2015);expect(targetSaveState(order.id).disabled).toBe(false);
 });
 it('unregisters an old order and ignores its in-flight save when editor props switch',async()=>{
  const currentOrder=reactive(structuredClone(order)),{state,api}=await mount({order:currentOrder});moveTargetDraft(order.id,0,2012);
  let resolve;api.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));const saving=saveTargetDraft(order.id);
  currentOrder.id='f297afbf-172c-4304-99e7-eb1198191050';await nextTick();await nextTick();moveTargetDraft(currentOrder.id,0,2015);
  resolve({plan:{revision:'old',state:'pending',next_index:0,plan:{targets:[{price:2012,volume:.01}]}}});await saving;
  expect(await saveTargetDraft(order.id)).toBe(false);expect(state.draft.targets[0].price).toBe(2015);
  expect(api.mock.calls.filter(c=>c[0]==='target_save')).toHaveLength(1);
 });
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


describe('native broker position target management',()=>{
 it('renders its real template without an execution order',async()=>{
  const html=await renderToString(createSSRApp(Editor,{nativePosition:{accountId:'mock',login:42,server:'Demo',ticket:123,type:0,magic:0,direction:'long',symbol:'XAUUSD.gbe',entryPrice:2000},snapshot,online:false,api:vi.fn()}));
  expect(html).toContain('XAUUSD.gbe');expect(html).toContain('RR');expect(html).not.toContain('undefined');
 });
 const native={accountId:'account-two',accountName:'Konto 2',login:42,server:'Demo',ticket:123,magic:0,type:0,direction:'long',symbol:'XAUUSD.gbe',entryPrice:2000};
 it('reuses drag/split/chart-save and restores a native 25/75 plan without inventing an initial SL',async()=>{
  let stored=null;
  const api=vi.fn(async(action,body)=>{expect(body.order_id).toBeUndefined();expect(body.position_ticket).toBe(123);if(action==='target_state')return {plan:stored};stored={revision:body.revision,state:'pending',next_index:0,plan:{targets:structuredClone(body.targets)}};return {plan:stored};});
  const current=structuredClone(snapshot);Object.assign(current.positions[0],{volume:.04,magic:0});
  const key=nativeTargetKey(native.accountId,native.ticket);
  const {state}=await mount({nativePosition:native,api,snapshot:current});
  expect(state.context.initialSl).toBeNull();expect(state.validation.value.targets[0].rr).toBeNull();
  splitTargetDraft(key,0);changeTargetShare(key,0,25);moveTargetDraft(key,1,2015);await nextTick();
  expect(await saveTargetDraft(key)).toBe(true);expect(stored.plan.targets.map(t=>t.volume)).toEqual([.01,.03]);
  expect(api.mock.calls.filter(c=>c[0]==='target_save')).toHaveLength(1);
  app.unmount();await mount({nativePosition:native,api,snapshot:current});
  expect(targetDraftLines('XAUUSD').map(t=>t.percent)).toEqual([25,75]);
 });
 it('does not attach controls to the same ticket with a different magic or account',async()=>{
  const current=structuredClone(snapshot);Object.assign(current.positions[0],{magic:7});
  const {state}=await mount({nativePosition:native,snapshot:current});expect(state.position).toBeUndefined();
  expect(await saveTargetDraft(nativeTargetKey(native.accountId,native.ticket))).toBe(false);
 });
});
