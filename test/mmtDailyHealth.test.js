import {it,expect} from 'vitest';
import {dailyHealth} from '../src/mmtDailyHealth.js';
const now=Date.parse('2026-11-11T12:00:00Z');
const stop={day:'2026-11-11',daily_loss_limit:1000,latched:false};
const snapshot={currency:'USD',risk:{day:stop.day,time:now/1000,realized_net_day:0,open_loss:0}};
it('uses net realized results plus open losses and caps healing at full HP',()=>{
 for(const [realized,openLoss,hp] of [[0,0,1000],[-320,-206,474],[-900,-150,0],[-100,0,900],[250,0,1000]]){
  expect(dailyHealth({...snapshot,risk:{...snapshot.risk,realized_net_day:realized,open_loss:openLoss}},stop,now).remaining).toBe(hp);
 }
});
it('never revives a latched daily stop after recovery',()=>{
 expect(dailyHealth(snapshot,{...stop,latched:true},now).remaining).toBe(0);
});
it('does not invent full HP from missing, stale or previous-day data at Berlin midnight',()=>{
 for(const s of [null,{...snapshot,currency:'EUR'},{...snapshot,risk:{...snapshot.risk,open_loss:1}},{...snapshot,risk:{...snapshot.risk,time:now/1000-16}}])expect(dailyHealth(s,stop,now)).toBeNull();
 expect(dailyHealth(snapshot,stop,Date.parse('2026-11-11T23:00:00Z'))).toBeNull();
});
