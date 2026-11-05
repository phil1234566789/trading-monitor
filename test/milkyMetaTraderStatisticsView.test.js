import {it,expect,vi} from 'vitest';
import {createSSRApp} from 'vue';
import {renderToString} from '@vue/server-renderer';
import Statistics from '../src/components/MilkyMetaTraderStatistics.vue';
it('shows unknown totals rather than zero performance for accounts without imported history',async()=>{
 const api=vi.fn();
 const html=await renderToString(createSSRApp(Statistics,{api,accounts:[{id:'a',name:'Challenge'}]}));
 expect(html).toContain('Noch keine Brokerhistorie');
 expect(html).toContain('Trades <strong>—</strong>');
 expect(api).not.toHaveBeenCalled();
});

it('uses the parent account filter without rendering a competing switcher',async()=>{
 const api=vi.fn();
 const accounts=Array.from({length:4},(_,i)=>({id:String(i),name:'Challenge '+(i+1),login:26000+i}));
 const html=await renderToString(createSSRApp(Statistics,{api,accounts,account:'1'}));
 expect(html).not.toContain('type="radio"');
 expect(html).not.toContain('mmt-stat-account-options');
 expect(html).toContain('Challenge 2');
 expect(html).toContain('0 / 1 Konten');
 expect(html).not.toContain('Challenge 1');
 expect(html).toContain('Asset<select');
 expect(html).toContain('Abschluss ab');
 expect(api).not.toHaveBeenCalled();
});

it('excludes archived accounts by default but preserves access to their statistics',async()=>{
 const accounts=[{id:'active',name:'Active'},{id:'failed',name:'Failed',archived:true}];
 for(const [account,label,count] of [['','Active',1],['failed','Failed',1],['all-history','Failed',2]]){
  const html=await renderToString(createSSRApp(Statistics,{api:vi.fn(),accounts,account}));
  expect(html).toContain(label);
  expect(html).toContain('0 / '+count+' Konten');
  if(!account)expect(html).not.toContain('Failed');
 }
});
