// Ablation der DOB-v7-Bausteine auf denselben gecachten Kerzen wie dobWinrate.mjs (0 Requests).
// Aufruf: node scripts/dobAblation.mjs [--only V1,V3] ; Vergleichsbasis .debug/dob-winrate/report-v6-final.json.
import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';import {createServer} from 'vite';
const root=fileURLToPath(new URL('../',import.meta.url)).replace(/[\/]$/,''),dir=path.join(root,'.debug','dob-winrate');
const VARIANTS={
 V0:{},V1:{nearTouch:'none'},V2:{nearTouch:'second'},V3:{maxRetestDepth:{first:.5,second:null}},V4:{maxRetestDepth:{first:null,second:.5}},
 V6:{stopRule:'m5Edge'},
 ...JSON.parse(process.argv.includes('--extra')?process.argv[process.argv.indexOf('--extra')+1]:'{}'),
};
const only=process.argv.includes('--only')?process.argv[process.argv.indexOf('--only')+1].split(','):Object.keys(VARIANTS);
const read=name=>JSON.parse(fs.readFileSync(path.join(dir,`report-${name}.json`),'utf8'));
const trades=(report,month)=>{
 const out={};
 for(const route of ['a','b']){
  const r=(month?report.months[month]:report.total)?.routes[route]??{success:0,loss:0,sumR:0};
  const n=r.success+r.loss;out[route]={n,winrate:n?r.success/n:null,sumR:r.sumR,avgR:n?r.sumR/n:null};
 }
 return out;
};
const server=await createServer({root,server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'silent'});
try{
 const {detectDoubleOrderBlocks}=await server.ssrLoadModule('/src/doubleOrderBlocks.js');
 const fx=n=>JSON.parse(fs.readFileSync(path.join(root,'test/fixtures/dob-native',`${n}.json`),'utf8'));
 const manifest=fx('references'),negatives=fx('negative-references');
 const references=options=>{
  const positives=manifest.pairs.filter(pair=>{
   const [a,b]=pair.pins.map(pin=>manifest.references.find(r=>r.pin===pin)),f=fx(a.day);
   return detectDoubleOrderBlocks({instrument:'XAUUSD',m5Candles:f.candles.m5,m1Candles:f.candles.m1,evaluatedAt:f.provenance.query.to,options})
    .pairs.some(p=>p.firstOrderBlock.startTime===a.startTime&&p.secondOrderBlock.startTime===b.startTime);
  }).map(p=>p.id);
  const rejected=negatives.cases.filter(c=>{
   const rows=tf=>[...new Map([c.first.sourceFixture,c.second.sourceFixture,...(c.additionalSources??[]).map(s=>s.file)]
    .flatMap(f=>fx(f.replace('.json','')).candles[tf]).map(x=>[x.time,x])).values()].sort((x,y)=>x.time-y.time);
   return !detectDoubleOrderBlocks({instrument:'XAUUSD',m5Candles:rows('m5'),m1Candles:rows('m1'),evaluatedAt:c.second.knownAt,options}).pairs.some(p=>p.id===c.key);
  }).length;
  return {positives:positives.length,missing:manifest.pairs.map(p=>p.id).filter(id=>!positives.includes(id)),negativesRejected:rejected};
 };
 const v6=read('v6-final'),v6Keys=new Set(v6.pairs.flatMap(p=>['a','b'].filter(r=>['success','loss'].includes(p.entries[r]?.outcome)).map(r=>`${p.id}:${r}`)));
 const v6SecondPartners=new Map(v6.pairs.map(p=>[p.id.split(':').at(-1),p.id]));
 const rows=[],diagnosis={};
 for(const name of only){
  const options=VARIANTS[name];
  execFileSync(process.execPath,[path.join(root,'scripts','dobWinrate.mjs'),'--name',`abl-${name}`,'--options',JSON.stringify(options)],{cwd:root,stdio:'ignore'});
  const report=read(`abl-${name}`),refs=references(options);
  for(const scope of [null,'2026-10','2026-11'])for(const [route,t] of Object.entries(trades(report,scope)))
   rows.push({variant:name,scope:scope??'gesamt',route,pairs:scope?report.months[scope]?.pairs:report.total.pairs,trades:t.n,
    winrate:t.winrate==null?'–':(t.winrate*100).toFixed(1)+'%',sumR:t.sumR,avgR:t.avgR==null?'–':t.avgR.toFixed(3),
    ...(scope?{}:{posRefs:`${refs.positives}/16${refs.missing.length?' −'+refs.missing.join(','):''}`,negRejected:`${refs.negativesRejected}/6`})});
  // Zusatz-Trades gegenüber v6 final, nach möglichem Grund (Mehrfachnennung).
  const extra={};
  for(const p of report.pairs)for(const r of ['a','b']){
   const outcome=p.entries[r]?.outcome;
   if(!['success','loss'].includes(outcome)||v6Keys.has(`${p.id}:${r}`))continue;
   const v6Pair=v6SecondPartners.get(p.id.split(':').at(-1));
   const reasons=[p.contacts.includes('nearTouch')&&'nearTouch',p.depths.some(d=>d>.5)&&'depth>50%',v6Pair&&v6Pair!==p.id&&'newPartner'].filter(Boolean);
   for(const reason of reasons.length?reasons:['other']){
    const bucket=extra[`${reason}:${r}`]??={trades:0,success:0,sumR:0};
    bucket.trades++;if(outcome==='success')bucket.success++;bucket.sumR+=outcome==='success'?2:-1;
   }
  }
  diagnosis[name]=Object.fromEntries(Object.entries(extra).map(([k,v])=>[k,{...v,winrate:(v.success/v.trades*100).toFixed(1)+'%'}]));
 }
 for(const [label,scope] of [['gesamt',null],['2026-10','2026-10'],['2026-11','2026-11']])for(const [route,t] of Object.entries(trades(v6,scope)))
  rows.unshift({variant:'v6',scope:label,route,pairs:scope?v6.months[scope]?.pairs:v6.total.pairs,trades:t.n,
   winrate:(t.winrate*100).toFixed(1)+'%',sumR:t.sumR,avgR:t.avgR.toFixed(3)});
 fs.writeFileSync(path.join(dir,'ablation.json'),JSON.stringify({variants:VARIANTS,rows,diagnosis},null,2));
 console.table(rows);console.log(JSON.stringify(diagnosis,null,1));
}finally{await server.close();}
