import {it,expect} from 'vitest';
import {createSSRApp} from 'vue';
import {renderToString} from '@vue/server-renderer';
import Balances from '../src/components/MilkyMetaTraderBalances.vue';
const now=Date.parse('2026-11-13T15:01:00Z'),account={id:'a',name:'Konto 2',login:26781,server:'s',mode:'live'};
const status={online:true,ui_cached:true,bridge:{heartbeat_at:new Date(now-30000).toISOString(),snapshot:{account_login:26781,account_server:'s',execution_ready:false,risk:{day:'2026-11-13',latched:true}}},daily_stop:{day:'2026-11-13',latched:true,reason:'daily_loss'},account_balances:[]};
const render=value=>renderToString(createSSRApp(Balances,{accounts:[account],activeId:'a',status:value,accountStatuses:{a:value},now,staleSeconds:15}));
it('shows the confirmed daily stop, not an obsolete broker-feed alarm for an intentional idle cache',async()=>{
 const html=await render(status);expect(html).toContain('Tagesstopp aktiv');expect(html).not.toContain('Brokerdaten seit');expect(html).not.toContain('Worker offline');
});
it('uses a neutral saved-state indicator while preserving known worker faults',async()=>{
 const value={...status,daily_stop:{day:'2026-11-13',latched:false},bridge:{...status.bridge,snapshot:{...status.bridge.snapshot,execution_ready:true,risk:{latched:false}}}};
 const html=await render(value);expect(html).toContain('Gespeicherter Stand');expect(html).toContain('data-neutral="true" role="status"');expect(html).not.toContain('Worker verbunden');expect(html).not.toContain('data-ready="true"');
 expect(await render({...value,bridge:{...value.bridge,snapshot:{...value.bridge.snapshot,worker_error:'fault'}}})).toContain('Worker gestört');
});
