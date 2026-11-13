// Reproduzierbarer SQL/Transport-Vergleich; lokale WASM-Laufzeiten ersetzen keine Live-API-Messung.
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {closedBrokerTrades} from '../src/milkyMetaTraderStatistics.js';
import {tradeCalendarWeeks} from '../src/milkyMetaTraderWeeks.js';
const {PGlite}=await import(process.env.MMT_PGLITE_MODULE?pathToFileURL(process.env.MMT_PGLITE_MODULE).href:new URL('../.debug/mmt-health-sql/node_modules/@electric-sql/pglite/dist/index.js',import.meta.url));
const db=new PGlite();
try{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
 for(const file of ['20261029090000_mt5_execution.sql','20261029180000_mt5_statistics.sql','20261105230000_mt5_imported_trades.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 const id=(await db.query("insert into mt5_accounts(name,login,server,mode,credentials) values('Fixture',42,'Demo','demo','{}') returning id")).rows[0].id;
 await db.query(`insert into mt5_broker_deals(account_id,ticket,position_id,time_msc,type,entry,symbol,volume,price,profit,commission,swap,fee,currency)
  select $1,n*2+e,n,1704103200000::bigint+(n%100)*604800000::bigint+e*3600000,case when e=0 then 0 else 1 end,e,'EURUSD.gbe',.5,1.1,
  case when e=0 then 0 else (n%5-2)*20 end,-2.5,0,0,'USD' from generate_series(1,1200) n cross join generate_series(0,1) e`,[id]);
 await db.exec(await readFile(new URL('../supabase/migrations/20261113180000_mt5_statistics_read_model.sql',import.meta.url),'utf8'));
 const measure=async fn=>{const runs=[];let value;for(let n=0;n<6;n++){const start=performance.now();value=await fn();if(n)runs.push(performance.now()-start);}return {...value,median_ms:runs.sort((a,b)=>a-b)[2],min_ms:runs[0],max_ms:runs.at(-1)};};
 const before=await measure(async()=>{let cursor=0,rows=[],requests=0,bytes=0;while(true){const page=(await db.query('select * from mt5_broker_deals where id>$1 order by id limit 500',[cursor])).rows;requests++;bytes+=Buffer.byteLength(JSON.stringify({rows:page}));if(!page.length)break;rows.push(...page);cursor=page.at(-1).id;}const trades=closedBrokerTrades(rows).trades;const week=tradeCalendarWeeks(trades)[0];return {requests,bytes,count:trades.length,week_count:week.trades.length};});
 const after=await measure(async()=>{const summary=(await db.query('select mt5_statistics_summary($1) data',[[id]])).rows[0].data;const page=(await db.query('select mt5_statistics_page($1,p_week=>$2) data',[[id],summary.weeks[0].key])).rows[0].data;return {requests:2,bytes:Buffer.byteLength(JSON.stringify(summary))+Buffer.byteLength(JSON.stringify(page)),count:summary.totals.count,week_count:page.rows.length};});
 if(before.count!==after.count||before.week_count!==after.week_count)throw new Error('Fixture result mismatch');
 console.log(JSON.stringify({fixture:'1200 closed positions / 2400 deals / 100 entry weeks; local PGlite, no network',before,after},null,2));
}finally{await db.close();}
