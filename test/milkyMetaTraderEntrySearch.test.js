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
function mount(query={},extra={}) {
  vi.stubGlobal('sessionStorage',{getItem:()=>null,removeItem:vi.fn()});
  route.query=reactive(query);
  const api=vi.fn().mockImplementation(async(action,{order})=>({preview:{intent:order,risk:1,confirmation_expires_sec:Date.now()/1000+30},confirmation:'signed'}));
  const now=Date.now()/1000,policy={revision:'policy',risk_base:50000,cost_buffer:5,drawdown_floor:47000,confirmed_balance:50000,confirmed_equity:50000,currency:'USD',day:'fixture',valid_until_sec:now+3600};
  const quote={bid:1.1,ask:1.1001,time:now,point:.00001,minimum_volume:.01,maximum_volume:100,volume_step:.01,stops_level:0,loss_per_unit_long:1000,loss_per_unit_short:1000};
  const status={online:true,risk_policy:policy,bridge:{snapshot:{balance:50000,equity:50000,currency:'USD',hedging:true,positions:[],pending_orders:0,risk_guards_ready:true,risk:{time:now,day:'fixture',latched:false,realized_net_day:0,open_loss:0},quotes:[{...quote,symbol:'EURUSD.gbe'},{...quote,symbol:'XAUUSD.gbe',bid:4000,ask:4000.1,point:.001,loss_per_unit_long:1,loss_per_unit_short:1}]}}};
  app=renderer.createApp({...EntrySearch,render:()=>h('div')},{api,status,account:{id:'demo',mode:'demo'},...extra});
  app.provide(ssrContextKey,{});
  const root={children:[]},vm=app.mount(root);
  return {state:vm.$.setupState,api,status:vm.$props.status};
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

describe('compact chart entry search',()=>{
 it('uses chart symbol and idea stop, never its anchor as trigger/reference',async()=>{
  const {state,api}=mount({}, {compact:true,chartSymbol:'XAUUSD.gbe',idea:{direction:'long',entry:4000,sl:3990,tp:null}});
  expect(state.durationMinutes).toBe(30);expect(state.riskMode).toBe('risky');
  state.riskMode='';await nextTick();
  route.query.direction='short';route.query.symbol='EURUSD.gbe';await nextTick();
  expect(state.direction).toBe('long');expect(state.symbol).toBe('XAUUSD.gbe');
  await state.showPreview();
  expect(api.mock.calls[0][1].order).toEqual({symbol:'XAUUSD.gbe',direction:'long',stop_loss:3990,take_profit:null,duration_sec:1800});
 });
 it('cannot prepare a broker search while replay or another gate disables it',async()=>{
  const {state,api}=mount({}, {compact:true,chartSymbol:'EURUSD.gbe',idea:{direction:'long',sl:1},disabled:true});
  await state.showPreview();expect(api).not.toHaveBeenCalled();
 });
 it('discards an in-flight preview if the idea changes',async()=>{
  const {state,api}=mount({symbol:'EURUSD.gbe',direction:'long',sl:'1.09'});let resolve;
  api.mockImplementation(()=>new Promise(r=>{resolve=r;}));
  const loading=state.showPreview();state.sl='1.08';await nextTick();
  resolve({preview:{intent:{id:'old'}},confirmation:'old'});await loading;
  expect(state.preview).toBeNull();expect(state.confirmation).toBe('');
 });
});

it('keeps dynamic entry search blocked without confirmed account limits',async()=>{
 const {state,api}=mount({}, {compact:true,chartSymbol:'XAUUSD.gbe',idea:{direction:'long',sl:3900},status:{online:true}});
 await state.showPreview();expect(api).not.toHaveBeenCalled();expect(state.preview).toBeNull();
});

it('updates dynamic lots with broker prices and sends only the chosen risk mode',async()=>{
 const {state,api,status}=mount({symbol:'EURUSD.gbe',direction:'long',sl:'1.09'});
 state.riskMode='full';await nextTick();
 const before=state.metrics.volume;
 status.bridge.snapshot.quotes[0].ask=1.101;state.now+=1000;await nextTick();
 expect(state.metrics.volume).toBeLessThan(before);
 await state.showPreview();
 expect(api.mock.calls.map(c=>c[0])).toEqual(['search_preview']);
 expect(api.mock.calls[0][1].order).toMatchObject({risk_mode:'full',stop_loss:1.09});
 expect(api.mock.calls[0][1].order).not.toHaveProperty('reference_price');
 expect(api.mock.calls[0][1].order).not.toHaveProperty('trigger_price');
});
