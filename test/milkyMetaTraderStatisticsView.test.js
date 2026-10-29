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
