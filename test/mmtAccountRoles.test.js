import {it,expect} from 'vitest';
import {createSSRApp} from 'vue';
import {renderToString} from '@vue/server-renderer';
import {accountsForRole} from '../src/mmtAccountRoles.js';
import EntrySearch from '../src/components/MmtBatchEntrySearch.vue';
import {mmtSearchFeedback} from '../src/mmtChartStatus.js';
const accounts=[{id:'one',name:'Alt',trade_role:'risky',archived:true},{id:'four',name:'Aktuell',trade_role:'risky'}];
it('routes by role independent of account number and fails closed for duplicate or all roles',()=>{
 expect(accountsForRole(accounts,'risky').map(a=>a.id)).toEqual(['four']);
 expect(accountsForRole(accounts,'all')).toEqual([]);
 expect(accountsForRole([...accounts,{id:'new',trade_role:'risky'}],'risky')).toEqual([]);
});
it('shows rejection before the first poll without surfacing old history again',()=>{
 const order={id:'new',status:'rejected',intent:{symbol:'XAUUSD'},result:{reason:'invalid_stop'}};
 const submitted=new Set(['new']);
 expect(mmtSearchFeedback([order],[],submitted)?.reason).toBe('invalid_stop');
 expect(mmtSearchFeedback([order],[order],submitted)).toBeNull();
 expect(mmtSearchFeedback([order],[],new Set())).toBeNull();
});
it('renders one compact role selector and keeps all-account execution disabled',async()=>{
 const html=await renderToString(createSSRApp(EntrySearch,{accounts,api:()=>{},statuses:{},now:Date.now()}));
 expect(html).toContain('Trade-Art und Konto');
 expect(html).toContain('value="all" disabled');
 expect(html).not.toContain('type="checkbox"');
 expect(html).toContain('compact-controls');
 expect(html).not.toContain('Bestätigte Ausführungen');
});
