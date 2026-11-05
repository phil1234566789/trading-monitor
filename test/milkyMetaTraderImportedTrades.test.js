import {it,expect,vi} from 'vitest';
import {importedClosedTrades} from '../src/milkyMetaTraderImportedTrades.js';
import {loadMmtHistory} from '../src/milkyMetaTraderHistory.js';
import {statisticsGroups} from '../src/milkyMetaTraderStatistics.js';
it('keeps CSV IDs distinct from native positions and never guesses missing directions or subtracts fees twice',async()=>{
 const source={account_id:'a',source_trade_id:'42',direction:null,volume:1,net:99,commission:-1,currency:'USD',symbol:'GBPUSD',opened_at:1790841600000,closed_at:1790845200000};
 const api=vi.fn().mockResolvedValue({rows:[],imports:[source],sync:[]});
 const history=await loadMmtHistory(api);
 const [trade]=importedClosedTrades(history.imports);
 expect(trade).toMatchObject({id:'csv:a:42',position_id:null,source:'csv',direction:null,net:99,commission:-1});
 expect(statisticsGroups([trade],'hour')[0]).toMatchObject({label:'10:00–10:59',count:1,net:99});
});
