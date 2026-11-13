import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {createRenderer,h,ref,nextTick,computed} from 'vue';
import {useMmtUiData} from '../src/composables/useMmtUiData.js';
import {useMmtExitEditor} from '../src/composables/useMmtExitEditor.js';
import {collectMmtBrokerPositions,projectBrokerPositions} from '../src/mmtBrokerPositions.js';
import {invalidateMmtUi,invalidateMmtPlans} from '../src/mmtUiInvalidation.js';
const renderer=createRenderer({createElement:()=>({children:[]}),createText:()=>({}),createComment:()=>({}),setText:()=>{},setElementText:()=>{},patchProp:()=>{},insert:(n,p)=>p.children.push(n),remove:()=>{},parentNode:()=>null,nextSibling:()=>null});
const accounts=[1,2,3].map(id=>({id:String(id),name:'Konto '+id,login:id,server:'Demo',mode:'demo'}));
const position=id=>({ticket:id,symbol:'XAUUSD.gbe',type:1,magic:0,price_open:3900,price_current:3890,volume:1,sl:3910,tp:3850,opened_at_sec:100});
let app,controller,enabled,credential,api,server,doc,events,editors;
const sections=['catalog','snapshots','orders','guards','balances','plans'];
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();await nextTick();};
function snapshot(id){return {account_login:id,account_server:'Demo',mode:'demo',currency:'USD',balance:50000,execution_ready:true,target_plans_ready:true,exit_plans_ready:true,trade_allowed:true,pending_orders:server.pendingOrders??0,positions:server.positions[id]??[],quotes:[{symbol:'XAUUSD.gbe',digits:2,minimum_volume:.01,volume_step:.01,point:.01,bid:3890,ask:3890.1}]};}
function response(action,fields={}){
 if(action==='ui_activity')return {revisions:{...server.revisions}};
 if(action==='target_state')return {plan:server.planPending?{revision:'pending',state:'pending',next_index:0,plan:{targets:[{price:3850,volume:1}],stops:[]}}:null};
 if(action!=='ui_state')throw new Error('Unexpected '+action);
 const data={revisions:{...server.revisions},account_statuses:{}};
 for(const section of fields.sections){
  if(section==='catalog'){data.accounts=accounts.map(account=>({...account,name:server.names[account.id]??account.name}));data.active_account_id='1';data.execution_enabled=true;data.server_live_allowed=true;for(const account of accounts)data.account_statuses[account.id]={risk_policy:{revision:'policy',currency:'USD'}};}
  if(section==='snapshots')for(const account of accounts)data.account_statuses[account.id]={...data.account_statuses[account.id],online:true,bridge:{heartbeat_at:new Date().toISOString(),snapshot:snapshot(account.login)}};
  if(section==='guards')for(const account of accounts)data.account_statuses[account.id]={...data.account_statuses[account.id],daily_stop:{day:'2026-11-13',latched:false,daily_stop_ready:true,daily_loss_limit:1000,checked_at_sec:Date.now()/1000,commands:[]}};
  if(section==='orders')data.orders=structuredClone(server.orders);
  if(section==='balances')data.account_balances=accounts.map(account=>({account_id:account.id,balance:50000}));
  if(section==='health')data.health={checked_at:new Date().toISOString(),incident:null,deliveries:[]};
 }
 return data;
}
beforeEach(()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-13T12:00:00Z'));events={};doc={visibilityState:'visible',addEventListener:(event,fn)=>{events[event]=fn;},removeEventListener:vi.fn()};vi.stubGlobal('document',doc);vi.stubGlobal('window',{addEventListener:(event,fn)=>{events[event]=fn;},removeEventListener:vi.fn()});
 server={positions:{},orders:[],revisions:Object.fromEntries(sections.map(section=>[section,1])),names:{},planPending:false};api=vi.fn(async(action,fields)=>response(action,fields));enabled=ref(true);credential='private';editors=[];
});
afterEach(()=>{app?.unmount();app=null;vi.useRealTimers();vi.unstubAllGlobals();});
function mount({withEditors=false,balances=false,health=false}={}){
 const Exit={props:['position','snapshot','online'],setup(props){const state=useMmtExitEditor({get nativePosition(){return props.position;},get snapshot(){return props.snapshot;},get online(){return props.online;},api,entryTime:100},()=>{});editors.push(state);return()=>null;}};
 app=renderer.createApp({setup(){
  controller=useMmtUiData({api,credential:()=>credential,enabled:()=>enabled.value,balances,health});
  const rows=computed(()=>collectMmtBrokerPositions(controller.accounts.value,controller.accountStatuses.value,controller.now.value));
  return()=>h('div',withEditors?projectBrokerPositions(rows.value,[]).map(row=>h(Exit,{key:row.id,position:row,snapshot:controller.accountStatuses.value[row.accountId]?.bridge?.snapshot,online:enabled.value&&row.online})):[]);
 }});app.mount({children:[]});
}
it('measures initial plus sixty seconds through the actual shared controller and three actual exit controllers',async()=>{
 const results={};
 for(const mode of ['idle','search','open','pending-exits','hidden']){
  api.mockClear();server.positions={};server.orders=[];server.planPending=mode==='pending-exits';doc.visibilityState=mode==='hidden'?'hidden':'visible';
  if(['open','pending-exits'].includes(mode))for(const id of [1,2,3])server.positions[id]=[position(id)];
  if(mode==='search')server.orders=[{id:'search',status:'searching',intent:{account_login:1,account_server:'Demo'}}];
  mount({withEditors:true});await flush();await vi.advanceTimersByTimeAsync(60000);await flush();
  results[mode]=api.mock.calls.reduce((all,[action])=>(all[action]=(all[action]??0)+1,all),{});app.unmount();app=null;
 }
 expect(results).toEqual({idle:{ui_state:1,ui_activity:2},search:{ui_state:8},open:{ui_state:8,target_state:3},'pending-exits':{ui_state:8,target_state:24},hidden:{}});
});
it('fetches only orders while searching and keeps snapshots, rules and guards explicitly cached',async()=>{
 server.orders=[{id:'s',status:'unknown',intent:{account_login:2,account_server:'Demo'}}];mount();await flush();await vi.advanceTimersByTimeAsync(60000);
 expect(controller.status.value.ui_cached).toBe(true);
 expect(api.mock.calls.filter(call=>call[0]==='ui_state').slice(1).every(call=>JSON.stringify(call[1].sections)===JSON.stringify(['orders']))).toBe(true);
 expect(controller.accountStatuses.value['1'].risk_policy.revision).toBe('policy');
});
it('discovers an external position at the next idle signal, then reads eight-second snapshots and returns to idle after closure',async()=>{
 mount({balances:true});await flush();await vi.advanceTimersByTimeAsync(29000);expect(api).toHaveBeenCalledTimes(1);
 server.positions[2]=[position(22)];server.revisions.snapshots++;await vi.advanceTimersByTimeAsync(1000);await flush();
 expect(controller.accountStatuses.value['2'].bridge.snapshot.positions).toHaveLength(1);
 const count=api.mock.calls.length;await vi.advanceTimersByTimeAsync(8000);expect(api).toHaveBeenCalledTimes(count+1);
 server.positions[2]=[];server.revisions.snapshots++;await vi.advanceTimersByTimeAsync(8000);await flush();
 expect(controller.accountStatuses.value['2'].bridge.snapshot.positions).toEqual([]);
 expect(api.mock.calls.filter(call=>call[0]==='ui_state'&&call[1].sections.includes('balances'))).toHaveLength(2);
 const closedCount=api.mock.calls.length;await vi.advanceTimersByTimeAsync(29000);expect(api).toHaveBeenCalledTimes(closedCount);
});
it('invalidates the catalog once after a change and omits balances and health when their UI is absent',async()=>{
 mount();await flush();server.names['1']='Updated';server.revisions.catalog++;
 invalidateMmtUi(['catalog']);await flush();expect(controller.accounts.value[0].name).toBe('Updated');expect(api).toHaveBeenCalledTimes(2);
 expect(api.mock.calls.every(call=>!call[1]?.sections?.some(section=>['balances','health'].includes(section)))).toBe(true);
});
it('checks displayed health at fifteen minutes, not on each active refresh',async()=>{
 server.positions[1]=[position(1)];mount({health:true,balances:true});await flush();await vi.advanceTimersByTimeAsync(900000);await flush();
 expect(api.mock.calls.filter(call=>call[0]==='ui_state'&&call[1].sections.includes('health'))).toHaveLength(2);
 expect(api.mock.calls.filter(call=>call[0]==='ui_state'&&call[1].sections.includes('catalog'))).toHaveLength(1);
});
it('coalesces overlapping reads and discards late data after lock or unmount',async()=>{
 let resolve;api.mockImplementation(()=>new Promise(r=>{resolve=r;}));mount();await flush();await vi.advanceTimersByTimeAsync(30000);expect(api).toHaveBeenCalledTimes(1);
 credential='';resolve(response('ui_state',{sections}));await flush();await vi.advanceTimersByTimeAsync(1000);expect(controller.accounts.value).toEqual([]);
});
it('pauses all reads with the panel hidden, resumes using a signal, and keeps cached controller state',async()=>{
 mount();await flush();const state=controller.accountStatuses.value['1'].bridge;
 enabled.value=false;await nextTick();await vi.advanceTimersByTimeAsync(60000);expect(api).toHaveBeenCalledTimes(1);expect(controller.accountStatuses.value['1'].bridge).toBe(state);
 enabled.value=true;await nextTick();await flush();expect(api.mock.calls.at(-1)[0]).toBe('ui_activity');
});

it('recovers an unchanged activity revision after a timeout without a full reload',async()=>{
 mount();await flush();api.mockRejectedValueOnce(new Error('timeout'));await vi.advanceTimersByTimeAsync(30000);expect(controller.error.value).toBe('timeout');
 await vi.advanceTimersByTimeAsync(30000);expect(controller.error.value).toBe('');expect(api.mock.calls.map(c=>c[0])).toEqual(['ui_state','ui_activity','ui_activity']);
});
it('retries failed sections at bounded cadence and restores offline state',async()=>{
 mount();await flush();api.mockRejectedValueOnce(new Error('timeout'));invalidateMmtUi(['snapshots']);await flush();expect(controller.accountStatuses.value['1'].online).toBe(false);
 await vi.advanceTimersByTimeAsync(29000);expect(api).toHaveBeenCalledTimes(2);await vi.advanceTimersByTimeAsync(1000);expect(controller.accountStatuses.value['1'].online).toBe(true);expect(controller.error.value).toBe('');
});
it('does not loop initial errors every second',async()=>{
 api.mockRejectedValue(new Error('offline'));mount();await flush();await vi.advanceTimersByTimeAsync(29000);expect(api).toHaveBeenCalledTimes(1);await vi.advanceTimersByTimeAsync(1000);expect(api).toHaveBeenCalledTimes(2);
});
it('retains follow-up invalidations while a response arrives in a hidden tab',async()=>{
 mount();await flush();let resolve;api.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));invalidateMmtUi(['snapshots']);await flush();
 doc.visibilityState='hidden';server.revisions.orders++;resolve(response('ui_state',{sections:['snapshots']}));await flush();expect(api).toHaveBeenCalledTimes(2);
 doc.visibilityState='visible';events.visibilitychange();await flush();expect(api).toHaveBeenCalledTimes(3);expect(api.mock.calls.at(-1)[1].sections).toEqual(['orders']);
});

it('starts the normal eight-second cadence after an early successful retry',async()=>{
 mount();await flush();api.mockRejectedValueOnce(new Error('timeout'));invalidateMmtUi(['snapshots']);await flush();
 server.positions[1]=[position(1)];await controller.refresh({sections:['snapshots']});await flush();const count=api.mock.calls.length;
 await vi.advanceTimersByTimeAsync(8000);expect(api).toHaveBeenCalledTimes(count+1);
});

it('retains plan invalidation received while hidden until the next visible editor read',async()=>{
 server.positions[1]=[position(1)];mount({withEditors:true});await flush();expect(api.mock.calls.filter(c=>c[0]==='target_state')).toHaveLength(1);
 doc.visibilityState='hidden';invalidateMmtPlans();await vi.advanceTimersByTimeAsync(8000);expect(api.mock.calls.filter(c=>c[0]==='target_state')).toHaveLength(1);
 doc.visibilityState='visible';await vi.advanceTimersByTimeAsync(8000);expect(api.mock.calls.filter(c=>c[0]==='target_state')).toHaveLength(2);
});
