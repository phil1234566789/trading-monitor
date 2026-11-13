import {it,expect,vi} from 'vitest';
import {loadMmtHistory} from '../src/milkyMetaTraderHistory.js';
it('keeps first-page journal links across following history pages',async()=>{
 const links=[{account_id:'a',broker_position_id:3105689,trade_position_id:156}];
 const api=vi.fn().mockResolvedValueOnce({rows:[{id:1}],journal_links:links}).mockResolvedValueOnce({rows:[]});
 expect((await loadMmtHistory(api)).journalLinks).toEqual(links);
});
