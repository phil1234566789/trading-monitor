import {afterEach,expect,it,vi} from 'vitest';
import {createSSRApp,createRenderer,h,nextTick,reactive,ssrContextKey} from 'vue';
import {renderToString} from '@vue/server-renderer';
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
  expect(state.canPrepare).toBe(true);
  statuses.normal.bridge.snapshot.quotes=[];await nextTick();
  expect(state.canPrepare).toBe(true);expect(state.accountDetails[0].order.symbol).toBe('XAUUSD.gbe');
  account.server='Other';statuses.normal.bridge.snapshot.account_server='Other';await nextTick();
  expect(state.canPrepare).toBe(false);expect(state.blockedReason).toContain('noch nicht zugeordnet');
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
