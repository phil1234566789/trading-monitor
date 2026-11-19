import {expect,it} from 'vitest';
import {missingDobModelTrades} from '../src/dobTradeStatistics.js';
const row={id:'r1',instrument:'GBPUSD',direction:'short',entry_time:1000,entry_price:1.31553};
const pin=(over={})=>({id:1,pinType:'model',dobTradeContext:{run_id:'dob-lq-sweep-gbpusd-v1',instrument:'GBPUSD',direction:'short',entry_time:1000,entry_price:1.31553},...over});
it('reports a model trade only when its POI type run in range lost it',()=>{
 expect(missingDobModelTrades([pin()],[row],{poiType:'lq_sweep'})).toEqual([]);
 expect(missingDobModelTrades([pin()],[],{poiType:'lq_sweep'})).toHaveLength(1);
 expect(missingDobModelTrades([pin()],[{...row,entry_time:1060}],{poiType:'lq_sweep'})).toHaveLength(1);
 expect(missingDobModelTrades([pin()],[],{poiType:'htf_ob'})).toEqual([]);
 expect(missingDobModelTrades([pin()],[],{poiType:'lq_sweep',fromSec:2000})).toEqual([]);
 expect(missingDobModelTrades([pin({pinType:'observation'})],[],{poiType:'lq_sweep'})).toEqual([]);
});
