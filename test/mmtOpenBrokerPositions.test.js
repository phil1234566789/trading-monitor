import {it,expect} from 'vitest';
import * as Vue from 'vue';
import {renderToString} from '@vue/server-renderer';
import {parse,compileScript} from '@vue/compiler-sfc';
import {compile} from '@vue/compiler-dom';
import {readFileSync} from 'node:fs';
import Positions from '../src/components/MmtOpenBrokerPositions.vue';
import LivePosition from '../src/components/MilkyMetaTraderLivePosition.vue';
import {collectMmtBrokerPositions,projectBrokerPositions} from '../src/mmtBrokerPositions.js';
import {findOrderPosition} from '../src/milkyMetaTraderMonitoring.js';

for(const [component,file] of [[Positions,'MmtOpenBrokerPositions'],[LivePosition,'MilkyMetaTraderLivePosition']]){
 const {descriptor}=parse(readFileSync(new URL(`../src/components/${file}.vue`,import.meta.url),'utf8'));
 component.render=new Function('Vue',compile(descriptor.template.content,{mode:'function',prefixIdentifiers:true,bindingMetadata:compileScript(descriptor,{id:file}).bindings}).code)(Vue);
}
const now=Date.parse('2026-11-13T13:00:03Z');
const accounts=[{id:'a',login:1,server:'s',name:'Normale Trades'},{id:'b',login:2,server:'s',name:'Sichere Trades'},{id:'archive',login:3,server:'s',archived:true}];
const position=(ticket,price=3900)=>({ticket,symbol:'XAUUSD.gbe',type:1,volume:.8,price_open:price,price_current:3890,sl:3910,tp:3850,profit:800});
const state=(login,positions,extra={})=>({online:true,bridge:{heartbeat_at:'2026-11-13T13:00:00Z',snapshot:{account_login:login,account_server:'s',currency:'USD',quotes:[{symbol:'XAUUSD.gbe',digits:2}],positions}},...extra});
const statuses={a:state(1,[position(10),position(20)]),b:state(2,[position(10,3901),position(30)]),archive:state(3,[position(99)])};

it('projects two accounts with two positions each and keeps equal symbol/tickets distinct',()=>{
 const rows=collectMmtBrokerPositions(accounts,statuses,now);
 expect(rows.map(row=>row.key)).toEqual(['a:10','a:20','b:10','b:30']);
 expect(rows.every(row=>row.online)).toBe(true);
 const order={id:'managed',status:'executed',intent:{account_login:2,account_server:'s',symbol:'XAUUSD.gbe',direction:'short'},result:{position:10}};
 expect(projectBrokerPositions(rows,[order]).map(row=>row.managedOrderId)).toEqual([undefined,undefined,'managed',undefined]);
 expect(findOrderPosition(order,rows[0].snapshot)).toBeNull();expect(findOrderPosition(order,rows[2].snapshot)).toBe(rows[2].position);
});
it('does not lose positions on a failed or stale account and removes them only on a successful empty snapshot',()=>{
 const failed={...statuses,b:{...statuses.b,online:false,status_error:'Timeout'}};
 const rows=collectMmtBrokerPositions(accounts,failed,now);
 expect(rows).toHaveLength(4);expect(rows.filter(row=>!row.online).map(row=>row.key)).toEqual(['b:10','b:30']);
 expect(collectMmtBrokerPositions(accounts,statuses,now+10000).every(row=>!row.online)).toBe(true);
 expect(collectMmtBrokerPositions(accounts,{...statuses,b:state(2,[])},now).map(row=>row.key)).toEqual(['a:10','a:20']);
 expect(collectMmtBrokerPositions(accounts,{a:statuses.b,b:statuses.a},now)).toEqual([]);
});
it('keeps a known newly inactive account as stale, never as live, without inventing archived positions',()=>{
 const archived=accounts.map(a=>a.id==='b'?{...a,archived:true}:a);
 const rows=collectMmtBrokerPositions(archived,{...statuses,b:{...statuses.b,online:false,inactive:true}},now);
 expect(rows).toHaveLength(4);expect(rows.filter(row=>row.account.id==='b').every(row=>!row.online&&row.account.archived)).toBe(true);
});
it('renders all four positions with visible account identity, per-account values and a retained failure warning',async()=>{
 const positions=collectMmtBrokerPositions(accounts,{...statuses,b:{...statuses.b,online:false,status_error:'Timeout'}},now).map(row=>({...row,commission:row.account.id==='a'?-4:-7}));
 const html=await renderToString(Vue.createSSRApp(Positions,{positions,issues:[{account:accounts[1],message:'Timeout'}]}));
 expect(html.match(/<article/g)).toHaveLength(4);expect(html).toContain('Offene Brokerpositionen · 4');
 for(const row of positions)expect(html).toContain(`${row.account.name} · Position ${row.position.ticket}`);
 expect(html).toContain('Sichere Trades · Timeout');expect(html).toContain('Stand nicht bestätigt');
 expect(html.match(/Commission bisher/g)).toHaveLength(4);expect(html).toContain('-4');expect(html).toContain('-7');
});
