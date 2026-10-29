import { describe,it,expect } from 'vitest';
import { buildMarketPreview,signMarketPreview,verifyMarketPreview } from '../supabase/functions/trading-monitor-mcp/marketPreviewContract.js';
const now=1800000000, id='c297afbf-172c-4304-99e7-eb1198191050';
const config={login:42,server:'Demo',mode:'demo',allowLive:false};
const input={symbol:'EURUSD.gbe',direction:'short',stop_loss:1.101,take_profit:1.099};
const snapshot={positions:[],pending_orders:0,trade_allowed:true,execution_ready:true,currency:'USD',quotes:[
  {symbol:'EURUSD.gbe',bid:1.1,ask:1.1001,time:now,point:.00001,digits:5,minimum_volume:.01,loss_per_unit_long:1000,loss_per_unit_short:1000}]};
describe('market preview authorization',()=>{
  it('uses the selected account, broker minimum and account-currency risk',()=>{
    const p=buildMarketPreview(input,snapshot,config,now,id);
    expect(p.intent.volume).toBe(.01);expect(p.intent.reference_price).toBe(1.1);
    expect(p.risk).toBeCloseTo(1);expect(p.intent.account_login).toBe(42);
  });
  it('blocks stale quotes, excessive risk, wrong targets and existing exposure',()=>{
    expect(()=>buildMarketPreview(input,snapshot,config,now+6,id)).toThrow();
    expect(()=>buildMarketPreview({...input,stop_loss:1.11},snapshot,config,now,id)).toThrow();
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
