import { describe, it, expect } from 'vitest';
import { isSameExecutionResult, validateDispatchAccount, validateExecutionIntent, validateWorkerSnapshot } from '../supabase/functions/trading-monitor-mcp/executionContract.js';

const now = 1800000000;
const config = { login: 42, server: 'Demo', allowLive: false };
const intent = (patch = {}) => ({ id:'c297afbf-172c-4304-99e7-eb1198191050',
  account_login:42, account_server:'Demo', mode:'demo', symbol:'GBPUSD', direction:'short',
  stop_loss:1.31, take_profit:1.28, risk_amount:2, trigger:'m1_close_below', trigger_price:1.3,
  created_sec:now, expires_sec:now+600, ...patch });

describe('MT5 execution boundary', () => {
  it('rechecks current live opt-in for a cached intent directly before dispatch',()=>{
    const live=intent({mode:'live'});
    expect(()=>validateDispatchAccount(live,{...config,allowLive:true})).not.toThrow();
    expect(()=>validateDispatchAccount(live,{...config,allowLive:false})).toThrow();
  });
  it('acknowledges an already stored result regardless of JSONB key order',()=>{
    const result={status:'executed',deal:123,volume:.01};
    expect(isSameExecutionResult({status:'executed',result:{volume:.01,deal:123,status:'executed'}},result)).toBe(true);
    expect(isSameExecutionResult({status:'executed',result:{...result,deal:456}},result)).toBe(false);
  });
  it('binds orders to the configured account and validates fresh bounded intent', () => {
    expect(validateExecutionIntent(intent(), config, now)).toEqual(intent());
    for (const patch of [{account_login:43},{account_server:'Other'},{mode:'live'},
      {risk_amount:6},{risk_amount:NaN},{stop_loss:0},{expires_sec:now},
      {expires_sec:now+3601},{created_sec:now-60},{trigger:'whatever'}, {symbol:'GBPUSD\n'}]) {
      expect(() => validateExecutionIntent(intent(patch), config, now)).toThrow();
    }
  });
  it('only enables the test trigger on demo even when live is enabled', () => {
    expect(validateExecutionIntent(intent({trigger:'test_next_m1_close',trigger_price:null}),config,now).trigger).toBe('test_next_m1_close');
    expect(() => validateExecutionIntent(intent({mode:'live',trigger:'test_next_m1_close'}),{...config,allowLive:true},now)).toThrow();
  });
  it('rejects unknown payload fields rather than passing unchecked instructions to the worker', () => {
    expect(() => validateExecutionIntent(intent({command:'run shell'}),config,now)).toThrow();
  });
  it('validates snapshots without accepting arbitrary credentials or forged account identity', () => {
    const snapshot={account_login:42,account_server:'Demo',mode:'demo',balance:50000,equity:50000,
      currency:'USD',trade_allowed:true,positions:[],pending_orders:0};
    expect(validateWorkerSnapshot(snapshot,config)).toEqual(snapshot);
    for(const patch of [{account_login:1},{positions:null},{equity:Infinity},{password:'secret'},
      {trade_allowed:'true'},{mode:'live'}]) expect(()=>validateWorkerSnapshot({...snapshot,...patch},config)).toThrow();
  });
});

// Eine Marktorder muss an die konkrete Vorschau gebunden bleiben.
describe('confirmed market intent',()=>{
  it('requires bounded lifetime, price and volume',()=>{
    const market=intent({trigger:'market_confirmed',reference_price:1.3,volume:.01,expires_sec:now+30});
    expect(validateExecutionIntent(market,config,now)).toEqual(market);
    for(const patch of [{volume:.02},{reference_price:0},{expires_sec:now+31}]) {
      expect(()=>validateExecutionIntent({...market,...patch},config,now)).toThrow();
    }
  });
});
