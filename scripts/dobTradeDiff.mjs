// Trade-für-Trade-Vergleich zweier dobWinrate-Reports mit Grund je Abweichung (beide Detektoren mit options.trace
// am Tagesende des Paares neu ausgewertet, Fenster wie dobWinrate.mjs). Aufruf:
// MSYS_NO_PATHCONV=1 node scripts/dobTradeDiff.mjs --left diff-v6 --left-detector /src/__v6doubleOrderBlocks.js --right abl-C4 --right-options '{...}'
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createServer} from 'vite';
const flag=name=>process.argv.includes(name)?process.argv[process.argv.indexOf(name)+1]:undefined;
const root=fileURLToPath(new URL('../',import.meta.url)).replace(/[\\/]$/,''),dir=path.join(root,'.debug','dob-winrate');
const read=name=>JSON.parse(fs.readFileSync(path.join(dir,`report-${name}.json`),'utf8'));
const left=read(flag('--left')),right=read(flag('--right'));
const R=outcome=>outcome==='success'?2:outcome==='loss'?-1:0;
const berlin=sec=>new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(sec*1000);
const trades=report=>new Map(report.pairs.flatMap(p=>['a','b'].filter(r=>['success','loss'].includes(p.entries[r]?.outcome))
 .map(r=>[`${p.id}:${r}`,{pair:p,route:r,...p.entries[r]}])));
const L=trades(left),Rt=trades(right);
const server=await createServer({root,server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'silent'});
try{
 const [leftModule,rightModule,{closedChecklistCandles},{markIgnoredCandles},{berlinDayRangeUtcMs,berlinDateStrFor,berlinOffsetMinutes},{TRADE_SETUP_M5_CANDLE_COUNT}]=
  await Promise.all([flag('--left-detector')??'/src/doubleOrderBlocks.js',flag('--right-detector')??'/src/doubleOrderBlocks.js',
   '/src/tradeSetupChecklistTimeBasis.js','/src/sessionOccurrences.js','/src/berlinTime.js','/src/priceChartConstants.js'].map(p=>server.ssrLoadModule(p)));
 const m5All=JSON.parse(fs.readFileSync(path.join(dir,'candles-XAUUSD-m5.json'),'utf8')),m1All=JSON.parse(fs.readFileSync(path.join(dir,'candles-XAUUSD-m1.json'),'utf8'));
 const sessions=JSON.parse(fs.readFileSync(path.join(dir,'sessions-XAUUSD.json'),'utf8'));
 const mark=rows=>markIgnoredCandles(rows,sessions,sec=>berlinOffsetMinutes(sec*1000));
 const window=(rows,bar,count,at)=>{const end=rows.findLastIndex(c=>c.time<=at)+1;return mark(closedChecklistCandles(rows.slice(Math.max(0,end-count),end),bar,at));};
 const dataEnd=right.dataEnd,cache=new Map();
 const evaluate=(module,options,at)=>{
  const key=`${module===leftModule}:${at}`;
  if(!cache.has(key))cache.set(key,module.detectDoubleOrderBlocks({instrument:'XAUUSD',evaluatedAt:at,options:{...options,trace:true},
   m5Candles:window(m5All,'5m',TRADE_SETUP_M5_CANDLE_COUNT,at),m1Candles:window(m1All,'1m',TRADE_SETUP_M5_CANDLE_COUNT*5+5,at)}));
  return cache.get(key);
 };
 const sides={left:[leftModule,JSON.parse(flag('--left-options')??'{}')],right:[rightModule,JSON.parse(flag('--right-options')??'{}')]};
 // Warum fehlt der Trade auf der anderen Seite? Erst Paarebene, dann OB-Reaktionen.
 const explain=(trade,other)=>{
  const [module,options]=sides[other],at=Math.min(berlinDayRangeUtcMs(berlinDateStrFor(trade.pair.recognizedAt)).endUtcMs/1000,dataEnd);
  const result=evaluate(module,options,at),[,, ,first,second]=trade.pair.id.split(':'),key=`${first}:${second}`;
  const same=result.pairs.find(p=>p.id===trade.pair.id);
  if(same){const e=same.entries[trade.route];return e.status==='ready'?'entryDiffers':`route:${e.status}:${e.reason??''}`;}
  if(result.pairs.some(p=>p.id.endsWith(`:${second}`)))return 'otherPartner';
  if(result.trace.pairs[key])return `pair:${result.trace.pairs[key]}`;
  const role=(start,name)=>{const t=result.trace.orderBlocks[start];return t?(t[name]??t):null;};
  const own=sides[other===`left`?'right':'left'],ownTrace=evaluate(own[0],own[1],at).trace;
  for(const [start,name] of [[first,'first'],[second,'second']]){
   const t=role(start,name),mine=ownTrace.orderBlocks[start]?.[name]??ownTrace.orderBlocks[start];
   if(!t)return `${name}OB:notDetected`;
   if(t.state!=='true')return `${name}OB:reaction:${t.state}${t.reason?':'+t.reason:''}`;
   if(mine&&t.fvg!==mine.fvg)return `${name}OB:reactionFvgDiffers`;
  }
  return 'notQualified';
 };
 const groups={onlyLeft:[],onlyRight:[],entryDiffers:[],same:[]};
 for(const [key,t] of L){const o=Rt.get(key);
  if(!o)groups.onlyLeft.push({key,trade:t,reason:explain(t,'right'),delta:-R(t.outcome)});
  else if(o.entryTime!==t.entryTime||o.entryPrice!==t.entryPrice||o.stopPrice!==t.stopPrice)groups.entryDiffers.push({key,trade:t,other:o,delta:R(o.outcome)-R(t.outcome),
   reason:o.entryTime!==t.entryTime?'entryTime':o.stopPrice!==t.stopPrice?'stop':'entryPrice'});
  else groups.same.push({key,trade:t,delta:0});
 }
 for(const [key,t] of Rt)if(!L.has(key))groups.onlyRight.push({key,trade:t,reason:explain(t,'left'),delta:R(t.outcome)});
 const stats=rows=>{const n=rows.length,w=rows.filter(r=>(r.other??r.trade).outcome==='success').length;
  return {trades:n,winrate:n?(w/n*100).toFixed(1)+'%':'–',sumR:rows.reduce((s,r)=>s+R((r.other??r.trade).outcome),0),delta:rows.reduce((s,r)=>s+r.delta,0)};};
 const byMonth=rows=>Object.fromEntries(['2026-10','2026-11'].map(m=>[m,stats(rows.filter(r=>berlinDateStrFor(r.trade.pair.recognizedAt).startsWith(m)))]));
 const reasons=rows=>{const out={};for(const r of rows){const k=r.reason.replace(/:\d+$/,'');(out[k]??=[]).push(r);}
  return Object.fromEntries(Object.entries(out).sort((a,b)=>a[1].reduce((s,r)=>s+r.delta,0)-b[1].reduce((s,r)=>s+r.delta,0)).map(([k,v])=>[k,{...stats(v),months:byMonth(v)}]));};
 const summary=Object.fromEntries(Object.entries(groups).map(([g,rows])=>[g,{...stats(rows),months:byMonth(rows),...(g==='same'?{}:{reasons:reasons(rows)})}]));
 const costly=[...groups.onlyLeft,...groups.onlyRight,...groups.entryDiffers].sort((a,b)=>a.delta-b.delta).slice(0,Number(flag('--top')??5)).map(r=>({
  key:r.key,group:groups.onlyLeft.includes(r)?'onlyLeft':groups.onlyRight.includes(r)?'onlyRight':'entryDiffers',reason:r.reason,deltaR:r.delta,
  pairKnown:berlin(r.trade.pair.recognizedAt),entry:`${berlin(r.trade.entryTime)} @ ${r.trade.entryPrice} SL ${r.trade.stopPrice} → ${r.trade.outcome}`,
  ...(r.other?{otherEntry:`${berlin(r.other.entryTime)} @ ${r.other.entryPrice} SL ${r.other.stopPrice} → ${r.other.outcome}`}:{})}));
 const out={left:flag('--left'),right:flag('--right'),summary,costly};
 fs.writeFileSync(path.join(dir,`tradediff-${flag('--left')}-${flag('--right')}.json`),JSON.stringify(out,null,2));
 console.log(JSON.stringify(out,null,1));
}finally{await server.close();}
