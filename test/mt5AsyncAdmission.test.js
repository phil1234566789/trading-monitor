import {afterEach,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({account:{id:'account',login:42,server:'Demo',mode:'demo'},bridge:null,policy:null,enqueue:vi.fn()}));
vi.mock('../supabase/functions/trading-monitor-mcp/mt5Credentials.ts',()=>({
 activeMt5Account:async()=>state.account,accountBridge:async()=>state.bridge,
 checked:({data,error})=>{if(error)throw error;return data;},
 mt5Database:()=>({from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:null})}),rpc:state.enqueue}),
}));
vi.mock('../supabase/functions/trading-monitor-mcp/mt5Risk.ts',()=>({readRiskPolicy:async()=>state.policy}));
vi.mock('../supabase/functions/trading-monitor-mcp/mt5Health.ts',()=>({scheduleMt5Health:vi.fn(),getMt5Health:vi.fn()}));
import {createExecutionOrder} from '../supabase/functions/trading-monitor-mcp/mt5Execution.ts';
import {buildEntrySearchPreview} from '../supabase/functions/trading-monitor-mcp/marketPreviewContract.js';
import {tradingDay} from '../supabase/functions/trading-monitor-mcp/dailyStopContract.js';
const now=1800000000,id='c297afbf-172c-4304-99e7-eb1198191050';
function setup(){
 vi.stubGlobal('Deno',{env:{get:()=> 'true'}});vi.spyOn(Date,'now').mockReturnValue(now*1000);
 state.policy={revision:id,day:tradingDay(now).day,confirmed_balance:50000,confirmed_equity:50000,risk_base:50000,cost_buffer:25,drawdown_floor:47000,valid_until_sec:now+1000,currency:'USD'};
 state.bridge={heartbeat_at:new Date(now*1000).toISOString(),snapshot:{account_login:42,account_server:'Demo',mode:'demo',balance:50000,equity:50000,currency:'USD',positions:[],quotes:[],pending_orders:0,hedging:true,trade_allowed:true,execution_ready:true,risk_guards_ready:true,risk:{day:state.policy.day,time:now,latched:false,realized_net_day:0,open_loss:0}}};
 state.enqueue.mockReset().mockImplementation(async(name,{new_intent})=>({data:{intent:new_intent,status:'searching'}}));
 const preview=buildEntrySearchPreview({symbol:'XAUUSD.gbe',direction:'long',stop_loss:3900,take_profit:null,risk_mode:'risky',duration_sec:1800},state.bridge.snapshot,{...state.account,riskPolicy:state.policy},now,id);
 const {created_sec,...input}=preview.intent;return input;
}
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
it('admits the signed dynamic search at confirmation even when no quote is present',async()=>{
 const input=setup(),result=await createExecutionOrder(input,true,'account');
 expect(result.status).toBe('searching');expect(state.enqueue).toHaveBeenCalledOnce();
 expect(state.enqueue.mock.calls[0][1].new_intent).toMatchObject({symbol:'XAUUSD.gbe',risk_mode:'risky',volume:.01});
});
it('still refuses enqueue when the fresh daily guard or account identity fails',async()=>{
 const input=setup();state.bridge.snapshot.risk.time-=6;
 await expect(createExecutionOrder(input,true,'account')).rejects.toThrow('daily_risk_unavailable');
 expect(state.enqueue).not.toHaveBeenCalled();
 state.bridge.snapshot.risk.time=now;state.bridge.snapshot.account_login=43;
 await expect(createExecutionOrder(input,true,'account')).rejects.toThrow('account_mismatch');
 expect(state.enqueue).not.toHaveBeenCalled();
});
