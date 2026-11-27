// Gleichheitsnachweis LS-Reaktion-Urteil alt (Basis-Commit, nach .debug/ls-owner-old entpackt) gegen neu auf echten trade_setups-Zeilen.
// node scripts/lsOwnerParity.mjs <tage> [instrument…]; Kerzen/Zeilen werden in .debug/ls-owner-parity gecacht.
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createServer} from 'vite';
const root=fileURLToPath(new URL('..',import.meta.url)).replace(/[\/]$/,'');
const out=path.join(root,'.debug','ls-owner-parity'),days=Number(process.argv[2]??7),only=process.argv.slice(3);
let envDir=root;
while(!existsSync(path.join(envDir,'.env'))&&path.dirname(envDir)!==envDir)envDir=path.dirname(envDir);
const server=await createServer({root,envDir,server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});
try{
 const load=p=>server.ssrLoadModule(p);
 const [{fetchInitialCandles},{supabase},{SESSION_ROW_COLUMNS,sessionFromRow}]=await Promise.all(
  ['/src/forexCandles.js','/src/supabaseClient.js','/src/sessionOccurrences.js'].map(load));
 const fresh=await import(pathToFileURL(path.join(root,'src/lsReactionRows.js')).href);
 const old=await import(pathToFileURL(path.join(root,'.debug/ls-owner-old/src/lsReactionRows.js')).href);
 await fs.mkdir(out,{recursive:true});
 const evaluatedAt=Math.floor(Date.now()/1000/300)*300,from=new Date((evaluatedAt-days*86400)*1000).toISOString();
 const summary=[];
 for(const instrument of only.length?only:['XAUUSD','GBPUSD','EURUSD']){
  const file=path.join(out,`${instrument}-${days}d.json`);
  let data=existsSync(file)?JSON.parse(await fs.readFile(file,'utf8')):null;
  if(!data){
   const rows=[];
   for(let page=0;;page++){
    const {data:chunk,error}=await supabase.from('trade_setups').select('*,trade_setup_sweeps(price,pivot_time,touched_time,timeframe,is_primary),ob_zones(top,bottom)')
     .eq('instrument',instrument).gte('ob_start_time',from).order('ob_start_time').order('id').range(rows.length,rows.length+999);
    if(error)throw error;
    if(!chunk.length)break;
    rows.push(...chunk);
   }
   const {data:s,error}=await supabase.from('sessions').select(SESSION_ROW_COLUMNS).eq('instrument',instrument).limit(200);
   if(error)throw error;
   const toMs=evaluatedAt*1000-1;
   const [m5,h1,d1]=await Promise.all([['5m',15000],['1h',6000],['1D',300]].map(([bar,n])=>fetchInitialCandles(instrument,bar,n,toMs)));
   data={evaluatedAt,rows,sessions:s.map(sessionFromRow),m5,h1,d1};
   await fs.writeFile(file,JSON.stringify(data));
  }
  let same=0;const diffs=[],times=[];
  for(const row of data.rows){
   const input={rows:[row],instrument,m5Candles:data.m5,h1Candles:data.h1,d1Candles:data.d1,evaluatedAt:data.evaluatedAt,sessionConfigs:data.sessions};
   let t=performance.now();const a=old.lsReactionRowVerdicts(input).get(row.id);const oldMs=performance.now()-t;
   t=performance.now();const b=fresh.lsReactionRowVerdicts(input).get(row.id);const newMs=performance.now()-t;
   times.push({id:row.id,oldMs,newMs,status:b?.status});
   if(JSON.stringify(a)===JSON.stringify(b))same++;else diffs.push({id:row.id,old:a,new:b});
  }
  const counts=Object.fromEntries(['passed','unmet','unknown'].map(k=>[k,times.filter(t=>t.status===k).length]));
  const top=[...times].sort((x,y)=>y.newMs-x.newMs).slice(0,3).map(t=>({id:t.id,newMs:Math.round(t.newMs),oldMs:Math.round(t.oldMs)}));
  const sum=k=>Math.round(times.reduce((s,t)=>s+t[k],0));
  const line={instrument,rows:data.rows.length,same,diffs:diffs.length,counts,oldMsTotal:sum('oldMs'),newMsTotal:sum('newMs'),slowestNew:top,
   slowestOld:[...times].sort((x,y)=>y.oldMs-x.oldMs).slice(0,3).map(t=>({id:t.id,oldMs:Math.round(t.oldMs),newMs:Math.round(t.newMs)}))};
  summary.push(line);console.log(JSON.stringify(line));
  if(diffs.length)console.log(JSON.stringify(diffs.slice(0,10)));
 }
 await fs.writeFile(path.join(out,`summary-${days}d.json`),JSON.stringify(summary,null,1));
}finally{await server.close();}
