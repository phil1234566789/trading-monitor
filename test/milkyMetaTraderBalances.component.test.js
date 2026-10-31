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
 expect(html).toContain('Handelskonto ausgewählt');
 expect(html).toContain('Balance $55000.00');
 expect(html).toContain('Equity $45000.00');
 expect(html).toContain('width:100%');
 expect(html).toMatch(/Winrate <strong[^>]*>unbekannt/);
 expect(html).toContain('Skala unbekannt');
 expect(html).toContain('Letzter bekannter Stand');
 expect(html).not.toContain('<button');
});
