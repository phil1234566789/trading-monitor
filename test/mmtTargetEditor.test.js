import {afterEach,describe,it,expect,vi} from 'vitest';
import {createRenderer,h,nextTick,reactive,ssrContextKey} from 'vue';
import {renderToString} from '@vue/server-renderer';
import {createSSRApp} from 'vue';
import Controls from '../src/components/MmtTargetChartControls.vue';
import Editor from '../src/components/MmtTargetEditor.vue';
import {moveTargetDraft,splitTargetDraft,changeTargetShare,targetDraftLines,addStopDraft} from '../src/mmtTargetDrafts.js';
import {saveTargetDraft,targetSaveState,nativeTargetKey,cancelTargetDraft} from '../src/mmtTargetSave.js';
const renderer=createRenderer({createElement:tag=>({tag,children:[],props:{}}),createText:text=>({text}),createComment:()=>({}),setText:(n,t)=>n.text=t,setElementText:(n,t)=>n.text=t,patchProp:(n,k,o,v)=>n.props[k]=v,insert:(n,p)=>p.children.push(n),remove:()=>{},parentNode:()=>null,nextSibling:()=>null});
let app;afterEach(()=>{app?.unmount();vi.unstubAllGlobals();vi.restoreAllMocks();});
const order={id:'e297afbf-172c-4304-99e7-eb1198191050',status:'executed',intent:{symbol:'XAUUSD.gbe',direction:'long',stop_loss:1990,account_login:42,account_server:'Demo'},result:{price:2000,volume:.01,position:123}};
const snapshot={account_login:42,account_server:'Demo',target_plans_ready:true,execution_ready:true,trade_allowed:true,positions:[{ticket:123,symbol:'XAUUSD.gbe',type:0,volume:.01,sl:1990,tp:2010}],quotes:[{symbol:'XAUUSD.gbe',minimum_volume:.01,volume_step:.01,maximum_volume:100,bid:2001,ask:2001.1,point:.01,stops_level:.01,digits:2,time:Date.now()/1000}]};
async function mount(extra={}){
 vi.stubGlobal('document',{visibilityState:'visible'});
 const api=extra.api??vi.fn().mockImplementation(async(action,body)=>action==='target_state'?{plan:null}:{plan:{revision:body.revision,state:'pending',next_index:0,plan:{targets:body.targets}}});
 const current=reactive(structuredClone(extra.snapshot??snapshot));
 app=renderer.createApp({...Editor,render:()=>h('div')},{order:extra.nativePosition?undefined:extra.order??order,nativePosition:extra.nativePosition,api,snapshot:current,online:extra.online??true,entryTime:100});
 app.provide(ssrContextKey,{});
 const vm=app.mount({children:[]});await nextTick();await nextTick();return {state:vm.$.setupState,api,snapshot:current};
}
describe('TP edits require Save',()=>{
 it('splits a native XAU position without SL only after the worker advertises support',async()=>{
  const current=structuredClone(snapshot);current.positions[0].volume=1;current.positions[0].sl=0;current.positions[0].magic=0;
  const nativePosition={accountId:'account',login:42,server:'Demo',ticket:123,symbol:'XAUUSD.gbe',direction:'long',entryPrice:2000,magic:0,type:0};
  const {state,api,snapshot:live}=await mount({snapshot:current,nativePosition});
  splitTargetDraft(nativeTargetKey('account',123),0);await nextTick();
  expect(state.allocation.targets.map(t=>t.volume)).toEqual([.5,.5]);
  expect(state.saveReason).toContain('Position hat keinen SL');await state.save();expect(api).toHaveBeenCalledTimes(1);
  live.target_without_sl_ready=true;await nextTick();expect(state.saveReason).toBe('');
  for(const age of [6,15]){live.quotes[0].time=Date.now()/1000-age;await nextTick();expect(state.saveReason).toBe('');}
  await state.save();expect(api.mock.calls[1][1]).toMatchObject({position_ticket:123,observed:{volume:1,sl:0,tp:2010},targets:[{price:2010,volume:.5},{price:2010,volume:.5}]});
 });
 it('keeps offline workers and missing native specifications blocked',async()=>{
  let mounted=await mount({online:false});moveTargetDraft(order.id,0,2012);await nextTick();expect(mounted.state.saveReason).not.toBe('');await mounted.state.save();expect(mounted.api).not.toHaveBeenCalled();
  app.unmount();mounted=await mount();moveTargetDraft(order.id,0,2012);delete mounted.snapshot.quotes[0].volume_step;await nextTick();expect(mounted.state.saveReason).not.toBe('');await mounted.state.save();expect(mounted.api).toHaveBeenCalledTimes(1);
 });
 it('cancels the entire position draft through the editor registry without an API write',async()=>{
  const {state,api}=await mount();splitTargetDraft(order.id,0);changeTargetShare(order.id,0,25);moveTargetDraft(order.id,0,2015);state.error='old failure';
  expect(cancelTargetDraft(order.id)).toBe(true);expect(state.draft.targets).toEqual([{price:2010,volume:.01}]);expect(state.draft.dirty).toBe(false);expect(state.error).toBe('');expect(api.mock.calls.filter(c=>c[0]==='target_save')).toHaveLength(0);
 });
 it('cannot pretend to cancel an in-flight or uncertain save',async()=>{
  const {state,api}=await mount();moveTargetDraft(order.id,0,2012);
  let reject;api.mockImplementationOnce(()=>new Promise((resolve,r)=>{reject=r;}));const saving=saveTargetDraft(order.id);
  expect(cancelTargetDraft(order.id)).toBe(false);reject(new Error('network'));await saving;
  expect(cancelTargetDraft(order.id)).toBe(false);expect(state.draft.dirty).toBe(true);
 });
 it('keeps a valid draft saveable between status polls and reports an authoritative rejection without retry',async()=>{
  const {state,api,snapshot:current}=await mount();moveTargetDraft(order.id,0,2012);
  current.quotes[0].time=Date.now()/1000-30;await nextTick();
  expect(state.ready).toBeTruthy();expect(state.saveReason).toBe('');
  api.mockRejectedValueOnce(Object.assign(new Error('target_position_unavailable'),{code:'target_position_unavailable'}));
  await state.save();expect(state.error).toBe('target_position_unavailable');expect(state.draft.dirty).toBe(true);
  expect(api.mock.calls.filter(c=>c[0]==='target_save')).toHaveLength(1);expect(state.uncertain).toBeNull();
  current.trade_allowed=false;await nextTick();expect(state.ready).toBe(false);
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
  await mount({api,snapshot:current});expect(targetDraftLines('XAUUSD').filter(line=>line.kind==='target').map(line=>line.percent)).toEqual([25,75]);
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
  expect(targetDraftLines('XAUUSD').filter(t=>t.kind==='target').map(t=>t.percent)).toEqual([25,75]);
 });
 it('does not attach controls to the same ticket with a different magic or account',async()=>{
  const current=structuredClone(snapshot);Object.assign(current.positions[0],{magic:7});
  const {state}=await mount({nativePosition:native,snapshot:current});expect(state.position).toBeUndefined();
  expect(await saveTargetDraft(nativeTargetKey(native.accountId,native.ticket))).toBe(false);
 });
});

describe('one confirmed plan for partial SL and TP',()=>{
 const native={accountId:'exit-account',login:42,server:'Demo',ticket:123,magic:0,type:0,direction:'long',symbol:'XAUUSD.gbe',entryPrice:2000};
 const costs={entry_costs:-5,entry_volume:1,estimated_exit_costs_per_lot:0,exit_sample_at:100};
 const previews={risky:{price:1997.75,budget:{requested:250,allocation:250,available:225,cost_buffer:25,effective_percent:.5}},full:{price:1995.75,budget:{requested:450,allocation:450,available:425,cost_buffer:25,effective_percent:.9}}};
 const current=()=>{const value=structuredClone(snapshot);value.exit_plans_ready=true;value.target_without_sl_ready=true;Object.assign(value.positions[0],{volume:1,sl:0,magic:0,swap:0});Object.assign(value.quotes[0],{loss_per_unit_long:1,profit_per_unit_long:1});return value;};
 const apiFor=stored=>vi.fn(async(action,body)=>action==='target_state'?{plan:stored,costs,stop_previews:previews}:{plan:{revision:body.revision,state:'pending',next_index:0,next_stop_index:0,plan:{targets:body.targets,stops:body.stops,native_sl:body.stops?.at(-1)?.price,risk_basis_sl:1997.75,risk_basis_source:'manual_stop_plan',exit_version:1}}});
 it('offers the cached 0.5 percent preview as a draft only and saves both legs together',async()=>{
  const api=apiFor(null),{state}=await mount({nativePosition:native,snapshot:current(),api}),key=nativeTargetKey(native.accountId,123);
  expect(addStopDraft(key,'risky')).toBe(true);expect(api.mock.calls.map(c=>c[0])).toEqual(['target_state']);
  splitTargetDraft(key,0,'stop');changeTargetShare(key,0,75,'stop');await nextTick();
  expect(state.draft.initialSl).toBeNull();expect(state.draft.basisSl).toBeNull();expect(state.saveReason).toBe('');
  await state.save();expect(api.mock.calls[1][1]).toMatchObject({position_ticket:123,targets:[{price:2010,volume:1}],stops:[{price:1997.75,volume:.75},{price:1997.75,volume:.25}],risk_mode:'risky',stops_changed:true,observed:{volume:1,sl:0,tp:2010}});
  expect(state.draft.basisSl).toBe(1997.75);expect(state.draft.dirty).toBe(false);
 });
 it('allows SL-only protection with an empty TP list without inventing a TP',async()=>{
  const live=current();live.positions[0].tp=0;const {state,api}=await mount({nativePosition:native,snapshot:live,api:apiFor(null)});
  expect(state.draft.targets).toEqual([]);expect(addStopDraft(state.context.key,'risky')).toBe(true);await nextTick();
  expect(state.saveReason).toBe('');await state.save();expect(api.mock.calls[1][1]).toMatchObject({targets:[],stops:[{price:1997.75,volume:1}]});
 });
 it('keeps a failed or unsupported risk preview unavailable without a broker write',async()=>{
  const live=current();live.exit_plans_ready=false;const {state,api}=await mount({nativePosition:native,snapshot:live,api:apiFor(null)});
  expect(addStopDraft(state.context.key,'risky')).toBe(false);expect(api.mock.calls.map(c=>c[0])).toEqual(['target_state']);
 });
 it('does not resend untouched native SLs when only TP is edited on an older worker',async()=>{
  const live=current();live.positions[0].sl=1990;live.exit_plans_ready=false;
  const {state,api}=await mount({nativePosition:native,snapshot:live,api:apiFor(null)});moveTargetDraft(state.context.key,0,2012);await nextTick();await state.save();
  expect(api.mock.calls[1][1]).not.toHaveProperty('stops');expect(api.mock.calls[1][1]).not.toHaveProperty('risk_mode');
  expect(api.mock.calls[1][1].observed.sl).toBe(1990);
 });
 it('restores saved remaining SL/TP legs and their established risk basis',async()=>{
  const stored={revision:'stored',state:'active',next_index:1,next_stop_index:1,plan:{targets:[{price:2010,volume:.4},{price:2020,volume:.6}],stops:[{price:1999,volume:.4},{price:1997,volume:.6}],risk_basis_sl:1995,risk_basis_source:'manual_stop_plan',risk_mode:'risky',exit_version:1}};
  const live=current();live.positions[0].volume=.6;live.positions[0].sl=1997;
  const {state}=await mount({nativePosition:native,snapshot:live,api:apiFor(stored)});
  expect(state.draft.targets).toEqual([{price:2020,volume:.6}]);expect(state.draft.stops).toEqual([{price:1997,volume:.6}]);expect(state.draft.basisSl).toBe(1995);
  moveTargetDraft(state.context.key,0,1996,'stop');moveTargetDraft(state.context.key,0,2025);state.reset();
  expect(state.draft.stops[0].price).toBe(1997);expect(state.draft.targets[0].price).toBe(2020);expect(state.draft.dirty).toBe(false);
 });
 it('synchronizes externally tightened or removed native SLs during TP drafts, preserving explicit SL edits',async()=>{
  const live=current();live.positions[0].sl=1997.75;
  const {state,snapshot:actual}=await mount({nativePosition:native,snapshot:live,api:apiFor(null)});
  moveTargetDraft(state.context.key,0,2015);actual.positions[0].sl=1998;await nextTick();
  expect(state.draft.stops).toEqual([{price:1998,volume:1}]);expect(state.draft.targets[0].price).toBe(2015);
  actual.positions[0].sl=0;await nextTick();expect(state.draft.stops).toEqual([]);expect(state.canAddStop).toBe(true);
  addStopDraft(state.context.key,'risky');moveTargetDraft(state.context.key,0,1997,'stop');actual.positions[0].sl=1999;await nextTick();
  expect(state.draft.stops[0].price).toBe(1997);expect(state.draft.stopsDirty).toBe(true);
 });
 it('distinguishes a TP-only edit from explicit SL intent on a stored shared plan',async()=>{
  const stored={revision:'stored',state:'active',next_index:0,next_stop_index:0,plan:{targets:[{price:2010,volume:1}],stops:[{price:1997.75,volume:1}],risk_basis_sl:1997.75,risk_mode:'risky',exit_version:1}};
  const live=current();live.positions[0].sl=1997.75;
  const {state,api}=await mount({nativePosition:native,snapshot:live,api:apiFor(stored)});
  moveTargetDraft(state.context.key,0,2015);await nextTick();await state.save();
  expect(api.mock.calls[1][1]).toMatchObject({stops:[{price:1997.75,volume:1}],stops_changed:false});
 });
});


it('closes only the cancelled position percent form after capture-phase drag Escape',async()=>{
 const row={orderId:'one',index:0,percent:50,totalPercent:100,targetCount:2,saveState:{},y:10,lineY:10};
 const current=reactive({rows:[row],cancellation:null}),TestControls={...Controls,render:()=>h('div')};app=renderer.createApp({render:()=>h(TestControls,current)});app.provide(ssrContextKey,{});
 app.mount({children:[]});const state=app._instance.subTree.component.setupState;state.edit(row);expect(state.editing).toBe('one:target:0');
 current.cancellation={orderId:'other'};await nextTick();expect(state.editing).toBe('one:target:0');
 current.cancellation={orderId:'one'};await nextTick();expect(state.editing).toBeNull();
});
