import {afterEach,expect,it,vi} from 'vitest';
import {createSSRApp,createRenderer,h,nextTick,reactive,ssrContextKey} from 'vue';
import {renderToString} from '@vue/server-renderer';
import {berlinDateStrFor} from '../src/berlinTime.js';
import EntrySearch from '../src/components/MmtBatchEntrySearch.vue';
const now=1800000000000;
const accounts=[{id:'normal',name:'Hauptkonto',login:42,server:'Demo',trade_role:'normal'},{id:'risky',name:'Risikokonto',login:43,server:'Demo',trade_role:'risky'}];
const policy={risk_base:50000,cost_buffer:25,drawdown_floor:47000,confirmed_balance:50000,confirmed_equity:50000,currency:'USD',day:'fixture',valid_until_sec:now/1000+3600};
function status(account,extra={}){return {online:true,risk_policy:policy,bridge:{snapshot:{account_login:account.login,account_server:account.server,execution_ready:true,trade_allowed:true,balance:50000,equity:50000,currency:'USD',hedging:true,positions:[],pending_orders:0,risk_guards_ready:true,risk:{time:now/1000,day:'fixture',latched:false,realized_net_day:0,open_loss:0},quotes:[{symbol:'XAUUSD.gbe',bid:4000,ask:4000.1,time:now/1000,point:.01,stops_level:0,minimum_volume:.01,maximum_volume:50,volume_step:.01,loss_per_unit_long:1,loss_per_unit_short:1}]}},...extra};}
async function render(extra={}){
 vi.stubGlobal('sessionStorage',{getItem:key=>key==='mmt-entry-role'?'normal+risky':null});
 const api=vi.fn(),html=await renderToString(createSSRApp(EntrySearch,{api,accounts,now,symbol:'XAUUSD',idea:{direction:'long',sl:3990},statuses:Object.fromEntries(accounts.map(a=>[a.id,status(a)])),...extra}));
 expect(api).not.toHaveBeenCalled();return html;
}
afterEach(()=>vi.unstubAllGlobals());
it('explains separate account blockers visibly and on the disabled button',async()=>{
 const html=await render({statuses:{normal:status(accounts[0],{risk_policy:null}),risky:status(accounts[1],{online:false})}});
 expect(html).toContain('Prüfung beim Start: Gespeicherte Risikoregeln oder Kontogrenzen fehlen. Unter MMT prüfen.');
 expect(html).toContain('Risikokonto: Brokerverbindung offline');
 expect(html).toMatch(/<button[^>]*disabled[^>]*title="Risikokonto:/);
 expect(html).toContain('tabindex="0"');
 expect(html).not.toContain('Risikolimits, SL oder Restbudget prüfen');
});
it('keeps asynchronous registration enabled when quotes or live risk estimates are temporarily old',async()=>{
 const statuses=Object.fromEntries(accounts.map(a=>{const s=status(a);s.bridge.snapshot.quotes[0].time-=30;s.bridge.snapshot.risk.time-=30;return [a.id,s];}));
 const html=await render({statuses});
 expect(html).not.toMatch(/<button[^>]*disabled/);
 expect(html).toContain('Lot/RR beim Entry');
});
it('retains broker symbol knowledge only for the same account, server and asset',async()=>{
 vi.stubGlobal('sessionStorage',{getItem:key=>key==='mmt-entry-role'?'normal':null});
 const renderer=createRenderer({createElement:tag=>({tag,children:[]}),createText:text=>({text}),createComment:()=>({}),setText:()=>{},setElementText:()=>{},patchProp:()=>{},insert:(node,parent)=>parent.children.push(node),remove:()=>{},parentNode:()=>null,nextSibling:()=>null});
 const statuses=reactive({normal:status(accounts[0])}),account=reactive({...accounts[0]});
 const app=renderer.createApp({...EntrySearch,render:()=>h('div')},{accounts:[account],statuses,now,symbol:'XAUUSD',idea:{direction:'long',sl:3990},api:vi.fn()});
 app.provide(ssrContextKey,{});
 try{
  const state=app.mount({children:[]}).$.setupState;
  expect(state.canSubmit).toBe(true);
  statuses.normal.bridge.snapshot.quotes=[];await nextTick();
  expect(state.canSubmit).toBe(true);expect(state.accountDetails[0].order.symbol).toBe('XAUUSD.gbe');
  account.server='Other';statuses.normal.bridge.snapshot.account_server='Other';await nextTick();
  expect(state.canSubmit).toBe(false);expect(state.blockedReason).toContain('noch nicht zugeordnet');
 }finally{app.unmount();}
});
it('keeps a valid draft enabled without a misleading tooltip',async()=>{
 const html=await render();
 expect(html).not.toMatch(/<button[^>]*disabled/);
 expect(html).not.toContain('Entry suchen gesperrt');
});
it('explains replay and missing account assignments without sending anything',async()=>{
 expect(await render({disabled:true,disabledReason:'Replay aktiv'})).toContain('title="Replay aktiv"');
 expect(await render({accounts:[]})).toContain('Kontozuordnung fehlt oder ist mehrdeutig.');
});


const stateRenderer=createRenderer({createElement:tag=>({tag,children:[]}),createText:text=>({text}),createComment:()=>({}),setText:()=>{},setElementText:()=>{},patchProp:()=>{},insert:(node,parent)=>parent.children.push(node),remove:()=>{},parentNode:()=>null,nextSibling:()=>null});
async function mountSubmission(api,storage={}){
 vi.stubGlobal('sessionStorage',{getItem:key=>key==='mmt-entry-role'?'normal+risky':storage[key]??null,setItem:(key,value)=>{storage[key]=value;}});
 const props=reactive({accounts,statuses:Object.fromEntries(accounts.map(a=>[a.id,status(a)])),now,symbol:'XAUUSD',idea:{direction:'long',sl:3990},api});
 const TestEntry={...EntrySearch,render:()=>h('div')};
 const app=stateRenderer.createApp({render:()=>h(TestEntry,{...props})});app.provide(ssrContextKey,{});
 app.mount({children:[]});const state=app._instance.subTree.component.setupState;await nextTick();return {app,state,props,storage};
}
function previewFor(id){const a=accounts.find(a=>a.id===id);return {confirmation:'signed-'+id,preview:{confirmation_expires_sec:now/1000+30,intent:{id:'order-'+id,symbol:'XAUUSD.gbe',direction:'long',stop_loss:3990,account_login:a.login,account_server:a.server,expires_sec:now/1000+1800}}};}
it('starts the signed account-bound searches in one click and prevents repeated dispatch',async()=>{
 const api=vi.fn(async(action,body)=>action==='search_preview'?previewFor(body.account_id):{order:{id:'order-'+body.account_id,status:'searching'}});
 const {app,state}=await mountSubmission(api);
 try{
  await Promise.all([state.submit(),state.submit()]);await nextTick();await state.submit();
  expect(api.mock.calls.map(c=>c[0])).toEqual(['search_preview','search_preview','search_confirm','search_confirm']);
  expect(state.rows.map(r=>r.state)).toEqual(['searching','searching']);expect(state.canSubmit).toBe(false);
  expect(state.feedbackRows).toHaveLength(2);
 }finally{app.unmount();}
});
it('keeps partial rejection and uncertain dispatch across idea changes and reload without retry',async()=>{
 const api=vi.fn(async(action,body)=>{
  if(action==='search_preview')return previewFor(body.account_id);
  if(body.account_id==='normal')throw Object.assign(new Error('Policy blocked'),{definitiveRejection:true});
  throw new Error('timeout');
 });
 const first=await mountSubmission(api);
 try{
  await first.state.submit();expect(first.state.rows.map(r=>r.state)).toEqual(['rejected','unknown']);expect(first.state.error).toContain('Policy blocked');
  first.props.idea={direction:'short',sl:4010};await nextTick();expect(first.state.rows).toHaveLength(2);
  first.app.unmount();const second=await mountSubmission(api,first.storage);
  try{await second.state.submit();expect(api).toHaveBeenCalledTimes(4);expect(second.state.unresolved).toBe(true);expect(second.state.rows).toHaveLength(2);}finally{second.app.unmount();}
 }finally{first.app.unmount();}
});
it('reconciles a local accepted search by exact account identity and retains failures from other accounts',async()=>{
 const api=vi.fn(async(action,body)=>action==='search_preview'?previewFor(body.account_id):{order:{id:'order-'+body.account_id,status:'searching'}});
 const {app,state,props}=await mountSubmission(api);
 try{
  await state.submit();
  props.statuses.normal.orders=[{id:'order-normal',status:'expired',intent:{...previewFor('normal').preview.intent,account_login:99},result:{reason:'expired'}}];await nextTick();
  expect(state.rows[0].state).toBe('searching');
  props.statuses.normal.orders=[{id:'order-normal',status:'expired',intent:previewFor('normal').preview.intent,result:{reason:'expired'}}];await nextTick();
  expect(state.rows.map(r=>r.state)).toEqual(['expired','searching']);expect(api).toHaveBeenCalledTimes(4);
 }finally{app.unmount();}
});

it('does not enqueue if replay starts while the signed preview is pending',async()=>{
 let release;const gate=new Promise(resolve=>{release=resolve;});
 const api=vi.fn(async(action,body)=>{if(action==='search_preview'){await gate;return previewFor(body.account_id);}throw new Error('must not enqueue');});
 const {app,state,props}=await mountSubmission(api);
 try{const pending=state.submit();props.disabled=true;props.disabledReason='Replay aktiv';await nextTick();release();await pending;
  expect(api.mock.calls.map(c=>c[0])).toEqual(['search_preview','search_preview']);expect(state.rows.every(r=>r.state==='rejected')).toBe(true);expect(state.error).toContain('Replay aktiv');
 }finally{app.unmount();}
});
it('clears an uncertain warning only after an exact backend acknowledgement',async()=>{
 const api=vi.fn(async(action,body)=>{if(action==='search_preview')return previewFor(body.account_id);throw new Error('timeout');});
 const {app,state,props}=await mountSubmission(api);
 try{await state.submit();expect(state.unresolved).toBe(true);expect(state.error).toContain('timeout');
  for(const a of accounts)props.statuses[a.id].orders=[{id:'order-'+a.id,status:'searching',intent:previewFor(a.id).preview.intent}];await nextTick();
  expect(state.unresolved).toBe(false);expect(state.error).toBe('');expect(api).toHaveBeenCalledTimes(4);
 }finally{app.unmount();}
});

it('names the daily stop on the correct account instead of the generic trading blocker',async()=>{
 const halted=status(accounts[0]);halted.bridge.heartbeat_at=new Date(now).toISOString();halted.bridge.snapshot.execution_ready=false;
 halted.bridge.snapshot.risk={...halted.bridge.snapshot.risk,day:berlinDateStrFor(now/1000),latched:true};
 halted.daily_stop={day:berlinDateStrFor(now/1000),checked_at_sec:now/1000,latched:true,reason:'daily_loss'};
 const html=await render({statuses:{normal:halted,risky:status(accounts[1])}});
 expect(html).toContain('Hauptkonto: Tagesstopp aktiv: Tagesverlustgrenze erreicht');
 expect(html).not.toContain('Handel nicht bereit');
 expect(html).toMatch(/<button[^>]*disabled[^>]*title="Hauptkonto: Tagesstopp/);
});

it('allows fresh server preview after an offline idle cache without hiding a known worker fault',async()=>{
 const statuses=Object.fromEntries(accounts.map(a=>{const value=status(a,{online:false,ui_cached:true});value.bridge.snapshot.execution_ready=false;return [a.id,value];}));
 expect(await render({statuses})).not.toMatch(/<button[^>]*disabled/);
 statuses.normal.bridge.snapshot.worker_error='fault';expect(await render({statuses})).toContain('Worker gestört');
});
