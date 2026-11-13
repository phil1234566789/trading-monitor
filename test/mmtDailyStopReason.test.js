import {it,expect} from 'vitest';
import {entryDailyStopReason} from '../src/mmtDailyStopReason.js';
import {berlinDateStrFor} from '../src/berlinTime.js';
const now=1800000000000,day=berlinDateStrFor(now/1000);
const current=()=>({online:true,bridge:{heartbeat_at:new Date(now).toISOString(),snapshot:{positions:[],execution_ready:false,trade_allowed:true,risk:{day,time:now/1000,latched:true}}},daily_stop:{day,checked_at_sec:now/1000,latched:true,reason:'daily_loss'}});
it('reports the confirmed daily loss latch before generic execution readiness',()=>{
 expect(entryDailyStopReason(current(),now)).toContain('Tagesverlustgrenze erreicht');
 const riskOnly=current();delete riskOnly.daily_stop;expect(entryDailyStopReason(riskOnly,now)).toContain('Tagesstopp aktiv');
});
it('does not claim a current latch from old, missing or previous-day data',()=>{
 expect(entryDailyStopReason(current(),now+16000)).toBe('');
 const old=current();old.daily_stop.day='2000-01-01';old.bridge.snapshot.risk.day='2000-01-01';expect(entryDailyStopReason(old,now)).toBe('');
 const missing=current();delete missing.daily_stop;delete missing.bridge.snapshot.risk;expect(entryDailyStopReason(missing,now)).toBe('');
});
