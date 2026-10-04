import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {setupKey,differences} from './setup1Set.mjs';
import {isWithinTradingWindows} from '../supabase/functions/_shared/tradingHoursGate.ts';
import assert from 'node:assert/strict';

const root=process.argv[2] ?? 'local-data/setup1-builds/2026-10-04T19-40-02.694Z';
const output=process.argv[3] ?? 'local-data/setup1-audit';
const read=async file=>JSON.parse(await readFile(file,'utf8'));
const input=await read(path.join(root,'input.json'));
const report=await read(path.join(root,'report.json'));
const berlin=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const local=value=>Object.fromEntries(berlin.formatToParts(new Date(value)).map(p=>[p.type,p.value]));
const inWindows=(value,windows)=>isWithinTradingWindows(Date.parse(value)/1000,windows);
const histogram=(rows,key)=>{const out={};for(const r of rows){const k=key(r);out[k]=(out[k]??0)+1;}return out;};
const same=(a,b)=>typeof a==='number'&&typeof b==='number'?Math.abs(a-b)<1e-12:JSON.stringify(a)===JSON.stringify(b);
const substantive=c=>!['created_at','alert_price'].includes(c.field)&&!same(c.rebuilt,c.live);
const results=[];
for(const item of report.results){
  const dir=path.resolve('local-data/setup1-sets',item.id);
  const rows=await read(path.join(dir,'sources.json')),live=await read(path.join(dir,'live.json'));
  const liveKeys=new Map(live.map(r=>[setupKey(r),r])),rebuiltKeys=new Map(rows.map(r=>[setupKey(r),r]));
  const only=rows.filter(r=>!liveKeys.has(setupKey(r))),missing=live.filter(r=>!rebuiltKeys.has(setupKey(r)));
  const schedule=input.schedules.find(s=>s.instrument===item.instrument);
  const nearest=(r,candidates=live)=>candidates.filter(l=>l.direction===r.direction).reduce((best,l)=>{
    const distance=Math.abs(Date.parse(l.ob_start_time)-Date.parse(r.ob_start_time))/1000;
    return !best||distance<best.distance?{id:l.id,distance,lsEqual:Math.abs(l.ls_price-r.ls_price)<1e-12,
      fractalEqual:Math.abs(l.fractal_price-r.fractal_price)<1e-12,obEqual:Math.abs(l.ob_top-r.ob_top)<1e-12&&Math.abs(l.ob_bottom-r.ob_bottom)<1e-12}:best;
  },null);
  const details=only.map(r=>{const n=nearest(r);return {key:setupKey(r),createdAt:r.created_at,obTime:r.ob_start_time,
    outsideTrading:!inWindows(r.created_at,schedule.trading_windows),outsideAlarm:!inWindows(r.created_at,schedule.alarm_windows),
    nearest:n,category:n?.distance<=3600&&n.lsEqual&&n.fractalEqual?'nearSameLevelsShiftedOb':!inWindows(r.created_at,schedule.alarm_windows)?'outsideCurrentAlarm':'insideAlarmUnresolved',
    sweepCount:r.trade_setup_sweeps.length,primary:r.ls_timeframe};});
  const changes=rows.filter(r=>liveKeys.has(setupKey(r))).flatMap(r=>differences(r,liveKeys.get(setupKey(r))).filter(substantive).map(c=>({...c,key:setupKey(r)})));
  assert.equal(liveKeys.size,live.length);assert.equal(rebuiltKeys.size,rows.length);
  assert.equal(rows.length-only.length,live.length-missing.length);
  assert.equal(Object.values(histogram(details,r=>r.category)).reduce((a,b)=>a+b,0),only.length);
  results.push({instrument:item.instrument,setId:item.id,total:rows.length,live:live.length,shared:rows.length-only.length,
    only:only.length,missing:missing.length,categories:histogram(details,r=>r.category),
    outsideTrading:details.filter(r=>r.outsideTrading).length,outsideAlarm:details.filter(r=>r.outsideAlarm).length,
    hour:histogram(only,r=>local(r.created_at).hour),weekday:histogram(only,r=>local(r.created_at).weekday),
    sweepCount:histogram(details,r=>r.sweepCount),primary:histogram(details,r=>r.primary),
    distance:histogram(details,r=>!r.nearest?'none':r.nearest.distance<=300?'<=5min':r.nearest.distance<=3600?'<=1h':r.nearest.distance<=21600?'<=6h':'>6h'),
    fields:histogram(changes,r=>r.field),changedKeys:new Set(changes.map(r=>r.key)).size,
    months:item.months,details,missingRows:missing.map(r=>({id:r.id,key:setupKey(r),createdAt:r.created_at,obTime:r.ob_start_time,
      staleObDays:(Date.parse(r.created_at)-Date.parse(r.ob_start_time))/86400000,nearest:nearest(r,rows),notified:r.notified})),
    references:[3070,3125,5491,4986].filter(id=>live.some(r=>r.id===id)).map(id=>{const l=live.find(r=>r.id===id),r=rebuiltKeys.get(setupKey(l));return {id,live:l,rebuilt:r??null,changes:r?differences(r,l):null};})});
}
await mkdir(output,{recursive:true});await writeFile(path.join(output,'audit.json'),JSON.stringify({snapshot:root,results},null,2));
console.log(JSON.stringify(results.map(({details,missingRows,references,months,...r})=>r),null,2));
