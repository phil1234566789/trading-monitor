import {describe,it,expect} from 'vitest';
import {assessMt5Health,healthMessage} from '../supabase/functions/trading-monitor-mcp/mt5HealthContract.js';
const now=1800000000000;
const bridge={heartbeat_at:new Date(now).toISOString(),snapshot:{account_login:42,account_server:'Demo',execution_ready:true}};
const selected={id:'account',login:42,server:'Demo'};
describe('MMT independent health assessment',()=>{
  it('does not call a faulting but reachable worker healthy',()=>{
    const issue=assessMt5Health({selected,bridge:{...bridge,snapshot:{...bridge.snapshot,worker_error:{code:'AttributeError',stage:'prepare',line:12}}},orders:[]},now);
    expect(issue.code).toBe('AttributeError');
    expect(issue.key).toContain('prepare');
  });
  it('detects a stopped heartbeat independently of the worker',()=>{
    expect(assessMt5Health({selected,bridge:{...bridge,heartbeat_at:new Date(now-61000).toISOString()},orders:[]},now).code).toBe('worker_offline');
    expect(assessMt5Health({selected,bridge,orders:[]},now)).toBeNull();
    expect(assessMt5Health({selected:null,bridge:null,orders:[]},now)).toBeNull();
  });
  it('flags unknown send outcomes without claiming no trade occurred',()=>{
    expect(assessMt5Health({selected,bridge,orders:[{id:'o',status:'unknown'}]},now).code).toBe('send_outcome_unknown');
    const message=healthMessage({id:'i',code:'send_outcome_unknown',opened_at:new Date(now).toISOString()});
    expect(message).toContain('Broker');
    expect(message).not.toContain('42');
  });
});
