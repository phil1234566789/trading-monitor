import {expect,it} from 'vitest';
import {statisticsAccounts,ALL_HISTORY_ACCOUNTS} from '../src/milkyMetaTraderAccountSelection.js';
const accounts=[{id:'active'},{id:'failed',archived:true}];
it('keeps archived trades out of active totals while retaining explicit historical selections',()=>{
 expect(statisticsAccounts(accounts,'')).toEqual([accounts[0]]);
 expect(statisticsAccounts(accounts,'failed')).toEqual([accounts[1]]);
 expect(statisticsAccounts(accounts,ALL_HISTORY_ACCOUNTS)).toEqual(accounts);
 expect(statisticsAccounts(accounts,'missing')).toEqual([]);
});
