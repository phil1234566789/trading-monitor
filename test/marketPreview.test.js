import { describe,it,expect } from 'vitest';
import { buildMarketPreview,buildEntrySearchPreview,signMarketPreview,verifyMarketPreview } from '../supabase/functions/trading-monitor-mcp/marketPreviewContract.js';
const now=1800000000, id='c297afbf-172c-4304-99e7-eb1198191050';
const policy={revision:id,day:'2027-01-15',confirmed_balance:50000,confirmed_equity:50000,risk_base:50000,cost_buffer:10,currency:'USD',drawdown_floor:47000,valid_until_sec:now+1000};
const config={riskPolicy:policy,login:42,server:'Demo',mode:'demo',allowLive:false};
const input={symbol:'EURUSD.gbe',direction:'short',stop_loss:1.101,take_profit:1.099};
const snapshot={balance:50000,equity:50000,hedging:true,risk_guards_ready:true,risk:{day:policy.day,time:now,realized_net_day:0,open_loss:0,latched:false},positions:[],pending_orders:0,trade_allowed:true,execution_ready:true,currency:'USD',quotes:[
  {symbol:'EURUSD.gbe',bid:1.1,ask:1.1001,time:now,point:.00001,digits:5,minimum_volume:.01,maximum_volume:100,volume_step:.01,stops_level:.00001,loss_per_unit_long:1000,loss_per_unit_short:1000}]};
describe('market preview authorization',()=>{
  it('uses the selected account, broker minimum and account-currency risk',()=>{
    const p=buildMarketPreview(input,snapshot,config,now,id);
    expect(p.intent.volume).toBe(.01);expect(p.intent.reference_price).toBe(1.1);
    expect(p.risk).toBeCloseTo(1);expect(p.intent.account_login).toBe(42);
  });
  it('blocks stale quotes, wrong targets and existing exposure',()=>{
    expect(()=>buildMarketPreview(input,snapshot,config,now+6,id)).toThrow();

    expect(()=>buildMarketPreview({...input,take_profit:1.11},snapshot,config,now,id)).toThrow();
    expect(()=>buildMarketPreview(input,{...snapshot,pending_orders:1},config,now,id)).toThrow();
  });
  it('rejects changed, expired and differently signed previews',async()=>{
    const p=buildMarketPreview(input,snapshot,config,now,id), secret='x'.repeat(40);
    const token=await signMarketPreview(p,secret);
    expect((await verifyMarketPreview(token,secret,now)).intent).toEqual(p.intent);
    await expect(verifyMarketPreview(token,'y'.repeat(40),now)).rejects.toThrow();
    await expect(verifyMarketPreview(token,secret,now+30)).rejects.toThrow();
    const changed=token.replace(token.split('.')[0],btoa(JSON.stringify({...p,risk:0})));
    await expect(verifyMarketPreview(changed,secret,now)).rejects.toThrow();
  });
});

describe('asynchronous search preview',()=>{
  it('binds candle color and expiry but never the preparation price',()=>{
    const p=buildEntrySearchPreview({...input,duration_sec:600},snapshot,config,now,id);
    expect(p.intent.trigger).toBe('m1_directional_close');
    expect(p.intent.trigger_price).toBeNull();
    expect(p.intent).not.toHaveProperty('reference_price');
    expect(p.intent.volume).toBe(.01);
    expect(p.reference_price).toBe(1.1);
    expect(p.intent.expires_sec).toBe(now+600);
    expect(p.confirmation_expires_sec).toBe(now+30);
    expect(p.volume).toBe(.01);
    for(const duration_sec of [0,61.5,3601]) expect(()=>buildEntrySearchPreview({...input,duration_sec},snapshot,config,now,id)).toThrow();
  });
  it('expires the activation view independently from the running search deadline',async()=>{
    const p=buildEntrySearchPreview({...input,duration_sec:600},snapshot,config,now,id);
    const secret='x'.repeat(40),token=await signMarketPreview(p,secret);
    await expect(verifyMarketPreview(token,secret,now+31)).rejects.toThrow();
  });
});

it('reports loss above five currency units without imposing an invented money limit',()=>{
  const p=buildEntrySearchPreview({...input,stop_loss:1.11,duration_sec:600},snapshot,config,now,id);
  expect(p.risk).toBeCloseTo(10);
  expect(p.intent.risk_amount).toBeCloseTo(p.risk);
  expect(p.intent.volume).toBe(.01);
  expect(()=>buildEntrySearchPreview({...input,duration_sec:600},{...snapshot,quotes:[{...snapshot.quotes[0],minimum_volume:.02}]},config,now,id)).toThrow();
});

for (const direction of ['short','long']) {
  it(`signs a ${direction} search without TP and keeps SL mandatory`,async()=>{
    const order={...input,direction,stop_loss:direction==='long'?1.099:1.101,duration_sec:600};
    for(const take_profit of [null,undefined]) {
      const p=buildEntrySearchPreview({...order,take_profit},snapshot,config,now,id);
      expect(p.intent.take_profit).toBeNull();
      const token=await signMarketPreview(p,'x'.repeat(40));
      expect((await verifyMarketPreview(token,'x'.repeat(40),now)).intent.take_profit).toBeNull();
    }
    for(const take_profit of [0,-1,NaN,Infinity,'',direction==='long'?1.09:1.11])
      expect(()=>buildEntrySearchPreview({...order,take_profit},snapshot,config,now,id)).toThrow();
    for(const stop_loss of [null,undefined,0,-1,direction==='long'?1.11:1.09])
      expect(()=>buildEntrySearchPreview({...order,take_profit:null,stop_loss},snapshot,config,now,id)).toThrow();
  });
}

describe('explicit protected dynamic entry sizing',()=>{
 it('signs risk mode and policy revision and keeps price unbound',()=>{
  const policy={revision:id,day:'2027-01-15',confirmed_balance:50000,confirmed_equity:50000,risk_base:50000,cost_buffer:10,currency:'USD',drawdown_floor:47000,valid_until_sec:now+1000};
  const dynamic={...snapshot,balance:50000,equity:50000,hedging:true,risk_guards_ready:true,risk:{day:policy.day,time:now,realized_net_day:0,open_loss:0,latched:false},
   quotes:snapshot.quotes.map(q=>({...q,maximum_volume:100,volume_step:.01,stops_level:.00001}))};
  const p=buildEntrySearchPreview({...input,duration_sec:1800,risk_mode:'risky'},dynamic,{...config,riskPolicy:policy},now,id);
  expect(p.intent.risk_mode).toBe('risky');expect(p.intent.risk_policy_revision).toBe(id);
  expect(p.intent.risk_amount).toBe(240);expect(p.volume).toBe(2.4);
  expect(p.intent.reference_price).toBeUndefined();expect(p.intent.trigger_price).toBeNull();
  expect(()=>buildEntrySearchPreview({...input,duration_sec:1800,risk_mode:'full'},dynamic,{...config,riskPolicy:null},now,id)).toThrow('risk_limits_unconfirmed');
 });
});

it('also blocks the pilot when no policy or insufficient daily remainder is confirmed',()=>{
 expect(()=>buildEntrySearchPreview({...input,duration_sec:600},snapshot,{...config,riskPolicy:null},now,id)).toThrow('risk_limits_unconfirmed');
 expect(()=>buildEntrySearchPreview({...input,duration_sec:600},{...snapshot,risk:{...snapshot.risk,realized_net_day:-999}},config,now,id)).toThrow();
});

it('allows expired signatures only for explicit abandonment and still rejects forgery',async()=>{
 const p=buildEntrySearchPreview({...input,duration_sec:600},snapshot,config,now,id);
 const token=await signMarketPreview(p,'x'.repeat(40));
 expect((await verifyMarketPreview(token,'x'.repeat(40),now+1000,{allowExpired:true})).intent.id).toBe(id);
 await expect(verifyMarketPreview(token,'y'.repeat(40),now+1000,{allowExpired:true})).rejects.toThrow();
 await expect(verifyMarketPreview(token,'x'.repeat(40),now+1000)).rejects.toThrow('preview_expired');
});
