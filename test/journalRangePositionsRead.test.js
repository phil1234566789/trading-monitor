import {beforeEach,expect,it,vi} from 'vitest';
const db=vi.hoisted(()=>({from:vi.fn()}));
const privateApi=vi.hoisted(()=>({privateJournalAvailable:vi.fn(),loadPrivateJournalPages:vi.fn()}));
vi.mock('../src/supabaseClient.js',()=>({supabase:db}));
vi.mock('../src/privateJournal.js',()=>privateApi);
vi.mock('../src/tradingAccounts.js',()=>({ALL_ACCOUNTS_ID:'all'}));
import {fetchTrades} from '../src/trades.js';
beforeEach(()=>vi.resetAllMocks());
const raw=(id,rangeId,account=5)=>({id,triggered_at:'2026-11-05T19:56:00Z',entry_price:id,trading_account_id:account,
 dealing_ranges:{id:rangeId,instrument:'XAUUSD',direction:'short'}});
it('scopes public pages to the DR, advances by actual response size and includes only matching private executions across accounts',async()=>{
 const publicRows=[raw(151,128),raw(152,128,7),raw(153,128),raw(154,128),raw(155,128)],queries=[],offsets=[];
 db.from.mockImplementation(table=>{
  const record={table,filters:[]};queries.push(record);const query={};
  query.select=()=>query;query.eq=(column,value)=>{record.filters.push([column,value]);return query;};query.order=()=>query;
  query.range=async start=>{offsets.push(start);return {data:publicRows.slice(start,start+2),error:null};};
  query.in=async()=>({data:[],error:null});return query;
 });
 privateApi.privateJournalAvailable.mockReturnValue(true);privateApi.loadPrivateJournalPages.mockResolvedValue([{...raw(900,128,9),broker_private:true},raw(901,129,9)]);
 const rows=await fetchTrades('XAUUSD','all',128);
 expect(rows.map(row=>row.id).sort((a,b)=>a-b)).toEqual([151,152,153,154,155,900]);expect(rows.find(row=>row.id===900).brokerPrivate).toBe(true);
 expect(offsets).toEqual([0,2,4,5]);
 for(const q of queries.filter(q=>q.table==='trade_positions')){
  expect(q.filters).toContainEqual(['dealing_range_id',128]);expect(q.filters.some(([name])=>name==='trading_account_id')).toBe(false);
 }
 expect(privateApi.loadPrivateJournalPages).toHaveBeenCalledWith('journal_positions',{instrument:'XAUUSD'});
});
