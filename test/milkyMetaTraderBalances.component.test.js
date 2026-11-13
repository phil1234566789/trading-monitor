import {expect,it} from 'vitest';
import * as Vue from 'vue';
import {renderToString} from '@vue/server-renderer';
import {parse,compileScript} from '@vue/compiler-sfc';
import {compile} from '@vue/compiler-dom';
import {readFileSync} from 'node:fs';
import Balances from '../src/components/MilkyMetaTraderBalances.vue';
import DailyStop from '../src/components/MmtDailyStopStatus.vue';
const dailyDescriptor=parse(readFileSync(new URL('../src/components/MmtDailyStopStatus.vue',import.meta.url),'utf8')).descriptor;
DailyStop.render=new Function('Vue',compile(dailyDescriptor.template.content,{mode:'function',prefixIdentifiers:true,bindingMetadata:compileScript(dailyDescriptor,{id:'daily'}).bindings}).code)(Vue);
const {descriptor}=parse(readFileSync(new URL('../src/components/MilkyMetaTraderBalances.vue',import.meta.url),'utf8'));
Balances.render=new Function('Vue',compile(descriptor.template.content,{mode:'function',prefixIdentifiers:true,bindingMetadata:compileScript(descriptor,{id:'balances'}).bindings}).code)(Vue);
it('renders all four accounts without activation controls and marks unknown data honestly',async()=>{
 const accounts=[1,2,3,4].map(id=>({id:String(id),login:id,server:'s',name:`Challenge ${id}`}));
 const html=await renderToString(Vue.createSSRApp(Balances,{accounts,activeId:'2',history:{rows:[],sync:[]},now:Date.now(),staleSeconds:30,
  status:{account_balances:[{account_id:'1',balance:55000,equity:45000,currency:'USD',loss_floor:47000,target:54000,
   balance_at:'2026-10-30T12:00:00Z',balance_source:'Brokerportal',limits_at:'2026-10-30T12:00:00Z',limits_source:'IQ Capital'}]}}));
 expect(html.match(/<article/g)).toHaveLength(4);
 expect(html).toContain('Aktives Handelskonto');
 expect(html).toContain('Balance $55000.00');
 for(const label of ['Equity','Netto-PnL','Positionen','Laufende Aufträge','Workerstand'])expect(html).not.toContain(label);
 expect(html.match(/<svg/g)).toHaveLength(4);
 expect(html).toContain('Challenge-Fortschritt 100 Prozent');
 expect(html).toContain('mmt-balance-risk');
 expect(html).toContain('mmt-balance-start');
 expect(html).toContain('mmt-balance-pointer');
 expect(html).toContain('mmt-balance-floor-marker');
 expect(html).toContain('Skala');
 expect(html).toContain('Verlustgrenze');
 expect(html).toContain('tabindex="0"');
 expect(html).toMatch(/Winrate <strong[^>]*>unbekannt/);
 expect(html).toContain('100 % geschafft');
 expect(html).toContain('mmt-balance-floor-label');
 expect(html).not.toContain('vom Challengeziel');
 expect(html).not.toContain('Balance <');
 expect(html).not.toContain('mmt-balance-details');
 expect(html).toContain('Fortschritt unbekannt');
 expect(html).toContain('Gespeicherter Stand')
 expect(html).toContain('Verbindung prüfen');
 expect(html.match(/class="mmt-balance-select"/g)).toHaveLength(4);
 expect(html).not.toContain('Als Handelskonto wählen');
});
it('keeps additional accounts in the same scrollable account strip',async()=>{
 const accounts=[1,2,3,4,5,6].map(id=>({id:String(id),login:id,server:'s',name:`Challenge ${id}`}));
 const html=await renderToString(Vue.createSSRApp(Balances,{accounts,history:{rows:[],sync:[]},now:Date.now(),staleSeconds:30}));
 expect(html.match(/<article/g)).toHaveLength(6);
 expect(html).toContain('Konten horizontal scrollen');
});
it('integrates broker identity and worker readiness only into the active account card',async()=>{
 const now=Date.now(),accounts=[{id:'a',login:1,server:'BeyondIQCapital-Server',name:'Trading',mode:'live'},{id:'b',login:2,server:'Other',name:'Inactive worker',mode:'demo'}];
 const status={online:true,server_live_allowed:true,bridge:{heartbeat_at:new Date(now).toISOString(),snapshot:{account_login:1,account_server:'BeyondIQCapital-Server',execution_ready:true,trade_allowed:true}}};
 const html=await renderToString(Vue.createSSRApp(Balances,{accounts,activeId:'a',status,now,staleSeconds:15}));
 expect(html).toContain('BeyondIQCapital-Server · Real / Challenge');
 expect(html).toContain('Other · Demo');
 expect(html.match(/Worker verbunden · Freigabe je Entry geprüft/g)).toHaveLength(1);
 expect(html).not.toContain('Brokerdaten noch nicht verfügbar');
 const stale=await renderToString(Vue.createSSRApp(Balances,{accounts,activeId:'a',status,now:now+16000,staleSeconds:15}));
 expect(stale).toContain('seit 16 Sekunden nicht aktualisiert');
});

it('marks only recent reader observations current and falls back to a saved stand after an outage',async()=>{
 const now=Date.parse('2026-11-05T08:00:00Z');
 for(const [source,age,current] of [['MT5-Reader',30,true],['MT5-Reader',91,false],['Brokerportal',30,false]]){
  const html=await renderToString(Vue.createSSRApp(Balances,{accounts:[{id:'a',login:42,server:'s',name:'Other account'}],now,staleSeconds:15,history:{rows:[],sync:[]},
   status:{account_balances:[{account_id:'a',balance:49843.5,currency:'USD',loss_floor:47000,target:54000,balance_source:source,balance_at:new Date(now-age*1000).toISOString()}]}}));
  expect(html.includes('Daten aktuell')).toBe(current);
  expect(html.includes('Gespeicherter Stand')).toBe(!current);
 }
});

it('selects a statistics card independently of the active trading account, including unknown accounts',async()=>{
 const accounts=[{id:'a',login:1,server:'s',name:'Trading'},{id:'b',login:2,server:'s',name:'No history'}];
 const html=await renderToString(Vue.createSSRApp(Balances,{accounts,activeId:'a',statisticsAccount:'b',history:{rows:[],sync:[]},now:Date.now(),staleSeconds:15}));
 expect(html).toMatch(/aria-label="Statistik: Trading" aria-pressed="false"/);
 expect(html).toMatch(/aria-label="Statistik: No history" aria-pressed="true"/);
 expect(html).toContain('Aktives Handelskonto');
 expect(html).not.toContain('Als Handelskonto wählen');
});

it('hides breached accounts from the semicircle strip without deleting their archive selector',async()=>{
 const accounts=[{id:'active',name:'Active',login:2},{id:'failed',name:'Failed',login:1,archived:true}];
 const html=await renderToString(Vue.createSSRApp(Balances,{accounts,history:{rows:[],sync:[]},now:Date.now(),staleSeconds:15}));
 expect(html.match(/<article/g)).toHaveLength(1);
 expect(html).not.toContain('Statistik: Failed');
 expect(html).toContain('Alle aktive Konten');
 expect(html).toContain('Inaktive Konten (1)');
 const buttons=html.replace(/<!--.*?-->/g,'');
 expect(buttons).toMatch(/data-variant="plain"[^>]*>Inaktive Konten \(1\)<\/button>/);
 expect(buttons).toMatch(/data-variant="caret"[^>]*aria-label="Inaktive Konten-Untermenü"[^>]*>▾<\/button>/);
 expect(html).not.toContain('Inaktive Konten (1) ▾');
});

it('places separate daily HP below every active account gauge without mixing account values',async()=>{
 const now=Date.parse('2026-11-13T10:00:00Z'),accounts=[{id:'a',name:'A',login:1,server:'s'},{id:'b',name:'B',login:2,server:'s'},{id:'old',name:'Old',archived:true}];
 const daily=(login,realized)=>({online:true,bridge:{heartbeat_at:new Date(now).toISOString(),snapshot:{account_login:login,account_server:'s',currency:'USD',risk:{day:'2026-11-13',time:now/1000,realized_net_day:realized,open_loss:0}}},daily_stop:{day:'2026-11-13',daily_loss_limit:1000,latched:false,daily_stop_ready:true}});
 const html=await renderToString(Vue.createSSRApp(Balances,{accounts,activeId:'a',accountStatuses:{a:daily(1,-466.6),b:daily(2,-120)},now,staleSeconds:15}));
 const cards=html.match(/<article[\s\S]*?<\/article>/g);
 expect(cards).toHaveLength(2);
 for(const [i,hp] of [[0,'$533.40'],[1,'$880.00']]){
  expect(cards[i]).toContain(hp);expect(cards[i]).toContain('role="progressbar"');
  expect(cards[i].indexOf('mmt-daily-status')).toBeGreaterThan(cards[i].indexOf('mmt-balance-ends'));
 }
 const offline=await renderToString(Vue.createSSRApp(Balances,{accounts,accountStatuses:{a:daily(2,-466.6),b:{...daily(2,-120),online:false}},now,staleSeconds:15}));
 expect(offline).not.toContain('role="progressbar"');expect(offline.match(/Keine aktuellen Tageswerte/g)).toHaveLength(2);
});
