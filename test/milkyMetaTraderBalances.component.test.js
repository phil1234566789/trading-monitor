import {expect,it} from 'vitest';
import * as Vue from 'vue';
import {renderToString} from '@vue/server-renderer';
import {parse,compileScript} from '@vue/compiler-sfc';
import {compile} from '@vue/compiler-dom';
import {readFileSync} from 'node:fs';
import Balances from '../src/components/MilkyMetaTraderBalances.vue';
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
 expect(html).toContain('Fortschritt unbekannt');
 expect(html).toContain('Gespeicherter Stand')
 expect(html).toContain('Verbindung prüfen');
 expect(html).not.toContain('<button');
});
it('keeps additional accounts in the same scrollable account strip',async()=>{
 const accounts=[1,2,3,4,5,6].map(id=>({id:String(id),login:id,server:'s',name:`Challenge ${id}`}));
 const html=await renderToString(Vue.createSSRApp(Balances,{accounts,history:{rows:[],sync:[]},now:Date.now(),staleSeconds:30}));
 expect(html.match(/<article/g)).toHaveLength(6);
 expect(html).toContain('Konten horizontal scrollen');
});
