import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {closedBrokerTrades,filterBrokerTrades,statisticsGroups} from '../src/milkyMetaTraderStatistics.js';
import {tradePerformance,tradeExtremes} from '../src/milkyMetaTraderPerformance.js';
import {tradeCalendarWeeks} from '../src/milkyMetaTraderWeeks.js';
const {PGlite}=await import(process.env.MMT_PGLITE_MODULE?pathToFileURL(process.env.MMT_PGLITE_MODULE).href:new URL('../.debug/mmt-health-sql/node_modules/@electric-sql/pglite/dist/index.js',import.meta.url));
const migration='20261113180000_mt5_statistics_read_model.sql';
const ms=value=>Date.parse(value);
const closeEnough=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-7,`${actual} != ${expected}`);
function compareMetrics(actual,expected){for(const key of Object.keys(expected))expected[key]===null?assert.equal(actual[key],null):closeEnough(actual[key],expected[key]);}

test('persisted statistics match complete broker positions, filters, Berlin weeks and bounded pages',async()=>{
 const db=new PGlite();
 try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
  for(const file of ['20261029090000_mt5_execution.sql','20261029180000_mt5_statistics.sql','20261105230000_mt5_imported_trades.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  const accounts=(await db.query("insert into mt5_accounts(name,login,server,mode,credentials)values('Active',1,'Demo','demo','{}'),('Archived',2,'Demo','demo','{}') returning id")).rows.map(r=>r.id);
  await db.query('update mt5_accounts set archived=true where id=$1',[accounts[1]]);
  let ticket=0;const raw=[];
  const deal=(position,entry,type,at,volume=1,profit=0,other={})=>raw.push({account_id:accounts[0],ticket:++ticket,position_id:position,time_msc:ms(at),entry,type,symbol:'EURUSD.gbe',volume,price:1.1,profit,commission:-1,swap:0,fee:0,currency:'USD',...other});
  // Sonntag Berliner Ortszeit, Abschluss und Kosten erst in einer späteren Woche.
  deal(1,0,0,'2026-03-29T21:30:00Z');deal(1,1,1,'2026-03-30T09:00:00Z',.25,25);
  deal(1,1,1,'2026-04-07T09:00:00Z',.75,75);deal(1,0,7,'2026-04-08T09:00:00Z',0,-2,{commission:0});
  // Montag nach der Zeitumstellung gehört bereits zur nächsten Entry-Woche.
  deal(2,0,1,'2026-03-29T22:30:00Z');deal(2,1,0,'2026-04-01T09:00:00Z',1,-40);
  deal(3,0,0,'2026-10-25T22:30:00Z');deal(3,1,1,'2026-10-26T09:00:00Z',1,12);
  deal(4,0,0,'2026-10-25T23:30:00Z');deal(4,1,1,'2026-10-26T09:00:00Z',1,100,{currency:'EUR'});
  deal(5,0,0,'2026-11-01T10:00:00Z'); // offen
  deal(6,1,1,'2026-11-01T10:00:00Z'); // fehlender Entry
  deal(7,0,0,'2026-11-01T10:00:00Z');deal(7,2,1,'2026-11-01T11:00:00Z'); // Umkehrung
  deal(8,0,0,'2026-11-02T10:00:00Z');deal(8,1,1,'2026-11-03T10:00:00Z',1,30);
  deal(0,0,7,'2026-11-03T10:00:00Z',0,-5,{commission:0});
  deal(9,0,1,'2026-11-02T10:00:00Z',1,0,{account_id:accounts[1],symbol:'XAUUSD.gbe'});
  deal(9,1,0,'2026-11-03T10:00:00Z',1,80,{account_id:accounts[1],symbol:'XAUUSD.gbe'});
  const insert=async rows=>{for(const r of rows)await db.query('insert into mt5_broker_deals(account_id,ticket,position_id,time_msc,type,entry,symbol,volume,price,profit,commission,swap,fee,currency) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',[r.account_id,r.ticket,r.position_id,r.time_msc,r.type,r.entry,r.symbol,r.volume,r.price,r.profit,r.commission,r.swap,r.fee,r.currency]);};
  await insert(raw); // Migration muss vorhandene Daten korrekt auffüllen.
  await db.exec(await readFile(new URL('../supabase/migrations/'+migration,import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261113210000_mt5_statistics_account_series.sql',import.meta.url),'utf8'));
  const csv={account_id:accounts[1],id:`csv:${accounts[1]}:old-1`,source_trade_id:'old-1',source:'csv',source_file:'archive.csv',symbol:'GBPUSD.gbe',currency:'USD',opened_at:ms('2026-03-29T22:00:00Z'),closed_at:ms('2026-03-30T12:00:00Z'),entry:1.2,exit:1.3,direction:null,volume:.5,net:49,commission:-1};
  await db.query("insert into mt5_imported_trades(account_id,source_trade_id,source_file,source_hash,symbol,currency,opened_at,closed_at,entry,exit,direction,volume,net,commission,source_row) values($1,'old-1','archive.csv','hash','GBPUSD.gbe','USD',$2,$3,1.2,1.3,null,.5,49,-1,'{}')",[accounts[1],csv.opened_at,csv.closed_at]);
  await db.query('insert into mt5_history_sync(account_id,last_full_at,synced_at) values($1,now(),now())',[accounts[0]]);
  const result=closedBrokerTrades(raw),all=[...result.trades,csv];
  const summary=async({ids=accounts,asset='',currency='USD',from=null,to=null,outcomes=['win','loss','breakeven'],limit=5}={})=>(await db.query('select mt5_statistics_summary($1,$2,$3,$4,$5,$6,$7) data',[ids,asset,currency,from,to,outcomes,limit])).rows[0].data;
  const stats=await summary(),expected=filterBrokerTrades(all,{currency:'USD'});
  compareMetrics(stats.totals,tradePerformance(expected));
  assert.equal(stats.excluded,result.excluded);assert.equal(stats.fees,-5);
  assert.ok(stats.position_commissions.some(p=>p.position_id===5));assert.ok(!stats.position_commissions.some(p=>p.position_id===1));
  const withClosed=(await db.query("select mt5_statistics_summary($1,'','USD',null,null,array['win','loss','breakeven'],5,$2) data",[accounts,JSON.stringify([{account_id:accounts[0],position_id:1}])])).rows[0].data;
  assert.equal(withClosed.position_commissions.find(p=>p.position_id===1).commission,result.trades.find(t=>t.position_id===1).commission);
  const accountTotal=stats.account_totals.find(t=>t.account_id===accounts[0]&&t.currency==='USD');
  closeEnough(accountTotal.net,tradePerformance(expected.filter(t=>t.account_id===accounts[0])).net-5);
  assert.deepEqual(stats.coverage.sort(),accounts.slice().sort());
  assert.deepEqual(stats.weeks.map(w=>[w.key,w.start,w.end,w.year,w.number,w.count]),tradeCalendarWeeks(expected).map(w=>[w.key,w.start,w.end,w.year,w.number,w.trades.length]));
  for(const dimension of ['asset','hour','weekday']){
   const groups=statisticsGroups(expected,dimension);assert.equal(stats.groups[dimension].length,groups.length);
   groups.forEach(({label,...metrics},i)=>{assert.equal(stats.groups[dimension][i].label,label);compareMetrics(stats.groups[dimension][i],metrics);});
  }
  assert.deepEqual(stats.extremes.winners.map(t=>t.id),tradeExtremes(expected).winners.map(t=>t.id));
  assert.deepEqual(stats.extremes.losers.map(t=>t.id),tradeExtremes(expected).losers.map(t=>t.id));
  for(const filter of [{ids:[accounts[0]],asset:'EURUSD.gbe',from:'2026-04-01',to:'2026-04-08',outcomes:['win']},{ids:[accounts[1]],outcomes:['win']},{outcomes:[]},{currency:'EUR'}]){
   const actual=await summary(filter),trades=filterBrokerTrades(all.filter(t=>(filter.ids??accounts).includes(t.account_id)),{currency:'USD',...filter});compareMetrics(actual.totals,tradePerformance(trades));
  }
  for(const w of stats.weeks){
   const data=(await db.query('select mt5_statistics_page($1,\'\',\'USD\',null,null,array[\'win\',\'loss\',\'breakeven\'],$2,0,100) data',[accounts,w.key])).rows[0].data;
   const expectedWeek=tradeCalendarWeeks(expected).find(x=>x.key===w.key);assert.deepEqual(data.rows.map(t=>t.id),expectedWeek.trades.map(t=>t.id));
   const imported=data.rows.find(t=>t.source==='csv');if(imported)assert.equal(imported.direction,null);
  }
  // Späte Kosten und Korrekturen werden sofort sichtbar, ohne erneute Rohdatenaggregation beim Lesen.
  const late={...raw[0],ticket:++ticket,type:7,entry:0,volume:0,profit:-6,commission:0,time_msc:ms('2026-11-12T10:00:00Z')};
  raw.push(late);await insert([late]);
  compareMetrics((await summary()).totals,tradePerformance(filterBrokerTrades([...closedBrokerTrades(raw).trades,csv],{currency:'USD'})));
  await db.query('update mt5_broker_deals set profit=profit+5 where account_id=$1 and ticket=$2',[late.account_id,late.ticket]);
  raw.at(-1).profit+=5;
  compareMetrics((await summary()).totals,tradePerformance(filterBrokerTrades([...closedBrokerTrades(raw).trades,csv],{currency:'USD'})));
  await db.query('delete from mt5_broker_deals where account_id=$1 and ticket=$2',[late.account_id,late.ticket]);raw.pop();
  compareMetrics((await summary()).totals,tradePerformance(expected));
  for(const role of ['anon','authenticated']){
   await db.exec('set role '+role);await assert.rejects(db.query('select * from mt5_statistics_positions'),/permission denied/);
   await assert.rejects(summary(),/permission denied/);await db.exec('reset role');
  }
  await db.exec('set role service_role');compareMetrics((await summary()).totals,tradePerformance(expected));await db.exec('reset role');
  // Mehr als PostgRESTs Tabellenlimit: RPC liefert einen begrenzten JSON-Block pro Seite.
  await db.query(`insert into mt5_imported_trades(account_id,source_trade_id,source_file,source_hash,symbol,currency,opened_at,closed_at,entry,exit,direction,volume,net,commission,source_row)
   select $1,'bulk-'||n,'bulk.csv','hash','BULK','USD',$2::bigint+n,$2::bigint+n+1000,1,2,'long',1,20,-1,'{}' from generate_series(1,1105) n`,[accounts[1],ms('2026-11-09T10:00:00Z')]);
  let offset=0,ids=[];
  do{
   const page=(await db.query("select mt5_statistics_page($1,'BULK','USD',null,null,array['win'],'2026-11-09',$2,9999) data",[accounts,offset])).rows[0].data;
   assert.ok(page.rows.length<=100);assert.equal(page.total,1105);ids.push(...page.rows.map(t=>t.id));offset=page.next_offset;
  }while(offset!==null);
  assert.equal(ids.length,1105);assert.equal(new Set(ids).size,1105);
  const series=(await db.query("select mt5_statistics_series($1,'BULK','USD',null,null,array['win'],0,9999) data",[accounts])).rows[0].data;
  assert.equal(series.rows.length,500);assert.equal(series.next_offset,500);
  assert.ok(series.rows.every(row=>row.account_id===accounts[1]));
  const mixedSeries=(await db.query('select mt5_statistics_series($1) data',[accounts])).rows[0].data;
  assert.deepEqual(new Set(mixedSeries.rows.map(row=>row.account_id)),new Set(accounts));
  const oneSeries=(await db.query('select mt5_statistics_series($1) data',[[accounts[0]]])).rows[0].data;
  assert.ok(oneSeries.rows.every(row=>row.account_id===accounts[0]));
  assert.deepEqual((await summary({asset:'nothing'})).groups,{});
  await db.query(`insert into mt5_imported_trades(account_id,source_trade_id,source_file,source_hash,symbol,currency,opened_at,closed_at,entry,exit,direction,volume,net,commission,source_row)
   select $1,'tie-'||n,'bulk.csv','hash',case when n=1 then 'AAA' else 'ZZZ' end,'USD',$2::bigint+n,$2::bigint+n+1000,1,2,'long',1,123,-1,'{}' from generate_series(1,3) n`,[accounts[1],ms('2026-11-09T10:00:00Z')]);
  const tied=(await summary()).groups.asset.filter(g=>['AAA','ZZZ'].includes(g.label));assert.deepEqual(tied.map(g=>g.label),['ZZZ','AAA']);
  // Auf Wochenwechseln darf die Quelldealtabelle nicht mehr beteiligt sein.
  const definitions=(await db.query("select pg_get_functiondef(oid) definition from pg_proc where proname in ('mt5_statistics_summary','mt5_statistics_page','mt5_statistics_series')")).rows;
  definitions.forEach(({definition})=>assert.ok(!definition.includes('mt5_broker_deals')));
  await db.query(`insert into mt5_statistics_positions(account_id,position_id,status,id,opened_at,entry_week)
   select $1::uuid,10000+n,'closed',$1::uuid::text||':'||(10000+n),1800000000000+n,'2024-01-01'::date+(n%100)*7 from generate_series(1,8000) n`,[accounts[1]]);
  await db.exec('analyze mt5_statistics_positions');
  const plan=(await db.query("explain(format json) select * from mt5_statistics_positions where account_id=$1 and status='closed' and entry_week='2024-01-08' order by opened_at desc,id desc limit 100",[accounts[1]])).rows[0]['QUERY PLAN'];
  assert.match(JSON.stringify(plan),/mt5_statistics_account_week/);
  await db.query(`insert into mt5_imported_trades(account_id,source_trade_id,source_file,source_hash,symbol,currency,opened_at,closed_at,entry,exit,volume,net,commission,source_row)
   select $1,'plan-'||n,'bulk.csv','hash','PLAN','USD',1704103200000::bigint+(n%100)*604800000::bigint,1704103201000::bigint+(n%100)*604800000::bigint,1,2,1,20,-1,'{}' from generate_series(1,8000) n`,[accounts[1]]);
  await db.exec('analyze mt5_imported_trades');
  const filteredPlan=(await db.query("explain(format json) select * from mt5_statistics_filtered($1,'','USD',null,null,array['win','loss','breakeven']) where entry_week='2024-01-08' order by opened_at desc,id desc limit 100",[accounts])).rows[0]['QUERY PLAN'];
  assert.match(JSON.stringify(filteredPlan),/mt5_statistics_account_week/);assert.match(JSON.stringify(filteredPlan),/mt5_imported_statistics_account_week/);
  assert.ok(!JSON.stringify(filteredPlan).includes('Function Scan'));
 }finally{await db.close();}
});
