import {it,expect,vi} from 'vitest';
import {readHistoryJournalLinks} from '../supabase/functions/trading-monitor-mcp/mt5HistoryJournal.js';
import {historyJournalKey,historyJournalRoute} from '../src/mmtHistoryJournal.js';
it('reads short row-capped pages to empty using unique position cursor',async()=>{
 const select=vi.fn().mockReturnThis(),gt=vi.fn().mockReturnThis(),order=vi.fn().mockReturnThis();
 const limit=vi.fn().mockResolvedValueOnce({data:[{trade_position_id:156}]}).mockResolvedValueOnce({data:[{trade_position_id:160}]}).mockResolvedValueOnce({data:[]});
 const query={select,gt,order,limit},db={from:()=>query};
 expect(await readHistoryJournalLinks(db)).toHaveLength(2);expect(gt.mock.calls.map(c=>c[1])).toEqual([0,156,160]);
});
it('matches account plus broker position and reuses journal route',()=>{
 const link={account_id:'a',broker_position_id:3105689,trade_position_id:156,trade_positions:{dealing_range_id:131,dealing_ranges:{instrument:'EURUSD'}}};
 expect(historyJournalKey(link)).toBe(historyJournalKey({account_id:'a',position_id:3105689}));
 expect(historyJournalKey(link)).not.toBe(historyJournalKey({account_id:'b',position_id:3105689}));
 expect(historyJournalRoute(link)).toEqual({path:'/',query:{journalTrade:156,instrument:'EURUSD'}});
 expect(historyJournalRoute(null)).toBeNull();
});
