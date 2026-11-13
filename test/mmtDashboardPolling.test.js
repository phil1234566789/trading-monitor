import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {createRenderer,h,ref,nextTick} from 'vue';
const fixture=vi.hoisted(()=>({api:vi.fn(),key:'private-key'}));
vi.mock('../src/milkyMetaTraderClient.js',()=>({createMilkyMetaTraderClient:()=>fixture.api}));
vi.mock('../src/milkyMetaTraderKey.js',()=>({readMilkyMetaTraderKey:()=>fixture.key}));
import {useDashboardMmt} from '../src/composables/useDashboardMmt.js';
import {mmtChartVisibility} from '../src/mmtChartStatus.js';
const renderer=createRenderer({createElement:()=>({children:[]}),createText:()=>({}),createComment:()=>({}),setText:()=>{},setElementText:()=>{},patchProp:()=>{},insert:(n,p)=>p.children.push(n),remove:()=>{},parentNode:()=>null,nextSibling:()=>null});
const accounts=[{id:'a',name:'Normal',login:1,server:'s'},{id:'b',name:'Sicher',login:2,server:'s'},{id:'archive',login:3,server:'s',archived:true}];
const position=ticket=>({ticket,symbol:'XAUUSD.gbe',type:1,opened_at_sec:100});
const state=(login,positions=[])=>({online:true,active_account_id:'a',orders:[],bridge:{heartbeat_at:new Date().toISOString(),snapshot:{account_login:login,account_server:'s',positions}}});
let app,mmt,doc,listeners,enabled;
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();await nextTick();};
function mount(){enabled=ref(true);app=renderer.createApp({setup(){mmt=useDashboardMmt(ref('XAUUSD'),()=>enabled.value);return()=>h('div');}});app.mount({children:[]});}
beforeEach(()=>{
 vi.useFakeTimers();fixture.key='private-key';listeners={};doc={visibilityState:'visible',addEventListener:vi.fn((event,fn)=>{listeners[event]=fn;}),removeEventListener:vi.fn()};vi.stubGlobal('document',doc);
 fixture.api.mockReset().mockImplementation(async(action,fields)=>{
  if(action==='ui_activity')return {revisions:{catalog:1,snapshots:1,orders:1}};
  if(action==='ui_state')return {accounts,active_account_id:'a',account_statuses:{a:state(1),b:state(2)},orders:[],revisions:{catalog:1,snapshots:1,orders:1}};
  throw new Error(`Unexpected ${action}`);
 });
});
afterEach(()=>{app?.unmount();app=null;vi.useRealTimers();vi.unstubAllGlobals();});
it('keeps live positions independent from the sidebar and suppresses every live source in snapshot mode',()=>{
 for(const panel of [false,true])for(const positions of [false,true])for(const cockpit of [false,true]){
  const visible=mmtChartVisibility(panel,positions,cockpit,false);
  expect(visible.controller).toBe(panel||positions);expect(visible.sidebar).toBe(panel||cockpit);expect(visible.positions).toBe(positions);
  expect(mmtChartVisibility(panel,positions,cockpit,true)).toEqual({controller:false,sidebar:false,positions:false,panel:false});
 }
});
it('uses one boot read and only an activity signal after thirty idle seconds',async()=>{
 mount();await flush();expect(fixture.api.mock.calls.map(c=>c[0])).toEqual(['ui_state']);
 await vi.advanceTimersByTimeAsync(29000);expect(fixture.api).toHaveBeenCalledTimes(1);
 await vi.advanceTimersByTimeAsync(1000);await flush();expect(fixture.api.mock.calls.map(c=>c[0])).toEqual(['ui_state','ui_activity']);
});
it('does not overlap polls, ignores results after unmount, and removes visibility subscriptions',async()=>{
 let resolve;fixture.api.mockImplementation(action=>action==='ui_state'?new Promise(r=>{resolve=r;}):Promise.resolve(state(1)));
 mount();await flush();const count=fixture.api.mock.calls.length;
 await vi.advanceTimersByTimeAsync(15000);expect(fixture.api).toHaveBeenCalledTimes(count);
 app.unmount();app=null;resolve({accounts,active_account_id:'a'});await flush();
 expect(mmt.accounts.value).toEqual([]);expect(doc.removeEventListener).toHaveBeenCalledWith('visibilitychange',listeners.visibilitychange);
});
it('suspends hidden tabs and refreshes immediately when shown again',async()=>{
 doc.visibilityState='hidden';mount();await flush();expect(fixture.api).not.toHaveBeenCalled();
 await vi.advanceTimersByTimeAsync(30000);expect(fixture.api).not.toHaveBeenCalled();
 doc.visibilityState='visible';listeners.visibilitychange();await flush();expect(fixture.api).toHaveBeenCalledTimes(1);
});
it('pauses an already mounted controller without losing bound state and resumes without a new instance',async()=>{
 mount();await flush();const statuses=mmt.accountStatuses.value;
 enabled.value=false;await nextTick();await vi.advanceTimersByTimeAsync(30000);expect(fixture.api).toHaveBeenCalledTimes(1);expect(mmt.accountStatuses.value).toBe(statuses);
 enabled.value=true;await nextTick();await flush();expect(fixture.api).toHaveBeenCalledTimes(2);
});
it('reads exposure on another account every eight seconds and preserves failed last-known snapshots',async()=>{
 fixture.api.mockImplementation(async()=>({accounts,active_account_id:'a',account_statuses:{a:state(1),b:state(2,[position(8)])},orders:[],revisions:{catalog:1,snapshots:1,orders:1}}));
 mount();await flush();await vi.advanceTimersByTimeAsync(8000);await flush();expect(fixture.api).toHaveBeenCalledTimes(2);
 fixture.api.mockRejectedValue(new Error('Timeout'));await mmt.refresh();await flush();expect(mmt.accountStatuses.value.b).toMatchObject({online:false,status_error:'Timeout'});
 expect(mmt.accountStatuses.value.b.bridge.snapshot.positions).toEqual([position(8)]);
});
it('discards late responses after locking and never reconstructs a closed order from history',async()=>{
 let resolve;fixture.api.mockImplementation(action=>action==='ui_state'?new Promise(r=>{resolve=r;}):Promise.resolve(state(1)));
 mount();await flush();fixture.key='';resolve({accounts,active_account_id:'a'});await flush();await mmt.refresh();
 expect(mmt.accounts.value).toEqual([]);expect(mmt.accountStatuses.value).toEqual({});expect(mmt.entryTimeFor({status:'executed',intent:{account_login:1,account_server:'s'},result:{position:8,position_lifecycle:{state:'closed'}}})).toBeNull();
});
