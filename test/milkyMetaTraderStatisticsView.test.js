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

it('renders all four accounts as an accessible display-only switcher even without history',async()=>{
 const api=vi.fn();
 const accounts=Array.from({length:4},(_,i)=>({id:String(i),name:'Challenge '+(i+1),login:26000+i}));
 const html=await renderToString(createSSRApp(Statistics,{api,accounts}));
 expect(html.match(/type="radio"/g)).toHaveLength(5);
 expect(html).toContain('Statistik nach Konto');
 expect(html).toContain('nur Anzeige');
 expect(html).toContain('Alle Konten');
 for(const a of accounts){expect(html).toContain(a.name);expect(html).toContain('#'+a.login);}
 expect(html.match(/Historie unbekannt/g)).toHaveLength(4);
 expect(html).not.toContain('<label>Konto<select');
 expect(html).toContain('Asset<select');
 expect(html).toContain('Abschluss ab');
 expect(api).not.toHaveBeenCalled();
});
