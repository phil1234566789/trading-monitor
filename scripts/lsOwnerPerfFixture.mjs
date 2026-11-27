// Einmalig: Fixture für den Laufzeit-/Paritätstest von findLiquiditySourceOwner (trade_setups #69401, XAU Short, LS-Pivot 24.11.).
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
const root=fileURLToPath(new URL('..',import.meta.url)).replace(/[\/]$/,'');
let envDir=root;
while(!existsSync(path.join(envDir,'.env'))&&path.dirname(envDir)!==envDir)envDir=path.dirname(envDir);
const server=await createServer({root,envDir,server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});
try{
 const load=p=>server.ssrLoadModule(p);
 const [{fetchInitialCandles},{supabase},{SESSION_ROW_COLUMNS,sessionFromRow},{lsReactionM5Start}]=await Promise.all(
  ['/src/forexCandles.js','/src/supabaseClient.js','/src/sessionOccurrences.js','/src/lsReactionRows.js'].map(load));
 const id=Number(process.argv[2]??69401),evaluatedAt=Number(process.argv[3]??Date.parse('2026-11-27T09:00:00Z')/1000);
 const {data:rows,error}=await supabase.from('trade_setups').select('*,trade_setup_sweeps(price,pivot_time,touched_time,timeframe,is_primary),ob_zones(top,bottom)').eq('id',id).limit(1);
 if(error)throw error;
 const instrument=rows[0].instrument;
 const {data:s,error:e2}=await supabase.from('sessions').select(SESSION_ROW_COLUMNS).eq('instrument',instrument).limit(200);
 if(e2)throw e2;
 const toMs=evaluatedAt*1000-1,pack=c=>c.map(({time,open,high,low,close})=>[time,open,high,low,close]);
 const h1=await fetchInitialCandles(instrument,'1h',6000,toMs),d1=await fetchInitialCandles(instrument,'1D',300,toMs);
 const from=lsReactionM5Start({rows,h1Candles:h1,d1Candles:d1});
 const m5=await fetchInitialCandles(instrument,'5m',Math.min(15000,Math.ceil((evaluatedAt-from)/300)),toMs);
 const out=path.join(root,'test/fixtures/ls-owner-perf',`${instrument.toLowerCase()}-${id}.json`);
 await fs.writeFile(out,JSON.stringify({id,instrument,evaluatedAt,rows,sessions:s.map(sessionFromRow),m5:pack(m5),h1:pack(h1),d1:pack(d1)}));
 console.log(out,{m5:m5.length,h1:h1.length,d1:d1.length,from});
}finally{await server.close();}
