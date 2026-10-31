import {expect,it} from 'vitest';
import {balancePosition,accountPerformance,accountBalance,challengeGauge,balanceHealth} from '../src/milkyMetaTraderBalances.js';

it('clamps only the display, retaining the actual balance and fixed loss floor',()=>{
 expect(balancePosition(46000,47000,54000)).toBe(0);
 expect(balancePosition(55000,47000,54000)).toBe(100);
 expect(balancePosition(50000,47000,54000)).toBeCloseTo(3000/7000*100);
 expect(balancePosition(50000,null,54000)).toBeNull();
 expect(balancePosition(null,47000,54000)).toBeNull();
 expect(balancePosition(50000,54000,54000)).toBeNull();
});
it('never replaces a newer portal observation with an old or faulty worker heartbeat',()=>{
 const account={id:'a',login:1,server:'s'};
 const saved={account_id:'a',balance:50800,balance_at:'2026-10-31T21:00:00Z',loss_floor:47800};
 const bridge={heartbeat_at:'2026-10-30T21:00:00Z',snapshot:{account_login:1,account_server:'s',balance:49900}};
 expect(accountBalance(account,saved,bridge).balance).toBe(50800);
 bridge.heartbeat_at='2026-10-31T21:01:00Z';
 expect(accountBalance(account,saved,bridge)).toMatchObject({balance:49900,loss_floor:47800});
 bridge.snapshot.worker_error={code:'offline'};
 expect(accountBalance(account,saved,bridge).balance).toBe(50800);
 bridge.snapshot.worker_error=null;bridge.snapshot.account_server='other';
 expect(accountBalance(account,saved,bridge).balance).toBe(50800);
});
it('counts proven closed trades and costs, never deposits or resets as trading profit',()=>{
 const trades=[{account_id:'a',currency:'USD',net:100},{account_id:'a',currency:'USD',net:-50},{account_id:'b',currency:'USD',net:200}];
 const result={trades,unallocated:[{account_id:'a',currency:'USD',profit:-2,commission:-1,swap:0,fee:0}],cash:[{account_id:'a',profit:50000}]};
 expect(accountPerformance('a','USD',result,{last_full_at:'date'})).toMatchObject({net:47,winrate:50,count:2});
 expect(accountPerformance('c','USD',result,null)).toMatchObject({net:null,winrate:null,count:0});
 expect(accountPerformance('c','USD',result,{last_full_at:'date'})).toMatchObject({net:0,winrate:null,count:0});
});

it('separates earned challenge progress from the drawdown part of the same scale',()=>{
 const g=challengeGauge(50846.49,47846.49,54000);
 expect(g.progress).toBeCloseTo(21.16225);
 expect(g.start).toBeCloseTo(3000/7000*100);
 expect(g.gain).toBeCloseTo(g.position-g.start);
 expect(g.floor).toBeCloseTo(846.49/7000*100);
 expect(challengeGauge(49500,47000,54000).gain).toBe(0);
 expect(challengeGauge(49500,47000,54000).position).toBeLessThan(g.start);
 expect(challengeGauge(55000,47000,54000).progress).toBe(100);
 expect(challengeGauge(null,47000,54000).position).toBeNull();
 expect(challengeGauge(50846.49,null,54000).floor).toBeNull();
});
it('shows green only for fresh, ready and independently monitored operation',()=>{
 const now=Date.parse('2026-10-31T22:00:00Z');
 const account={login:1,server:'s',mode:'live'};
 const status={online:true,server_live_allowed:true,bridge:{snapshot:{account_login:1,account_server:'s',execution_ready:true,trade_allowed:true}},health:{checked_at:new Date(now).toISOString()}};
 expect(balanceHealth(status,true,account,now).ok).toBe(true);
 expect(balanceHealth(status,false,account,now).ok).toBe(false);
 expect(balanceHealth({...status,online:false},true,account,now).ok).toBe(false);
 expect(balanceHealth({...status,health:{...status.health,incident:{code:'fault'}}},true,account,now).ok).toBe(false);
 expect(balanceHealth({...status,health:null},true,account,now).ok).toBe(false);
 expect(balanceHealth(status,true,account,now+151000).ok).toBe(false);
 expect(balanceHealth({...status,bridge:{snapshot:{...status.bridge.snapshot,trade_allowed:false}}},true,account,now).ok).toBe(false);
 expect(balanceHealth(status,true,{...account,login:2},now).ok).toBe(false);
 expect(balanceHealth({...status,server_live_allowed:false},true,account,now).ok).toBe(false);
});

it('uses the same fixed scale for both accounts while moving the floor independently',()=>{
 const baseline=challengeGauge(50000,47000,54000);
 const profit=challengeGauge(50846.49,47846.49,54000);
 expect(profit.start).toBe(baseline.start);
 expect(profit.position).toBeGreaterThan(baseline.position);
 expect(profit.position).toBeCloseTo((50846.49-47000)/7000*100);
 expect(challengeGauge(50846.49,49000,54000).position).toBe(profit.position);
 expect(profit.floor).toBeGreaterThan(baseline.floor);
 expect(challengeGauge(49500,47500,54000).position).toBeLessThan(baseline.position);
});
