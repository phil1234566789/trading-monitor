import {berlinWallTime} from './tradeSetupChecklistTime.js';
import {sessionOccurrences} from './sessionOccurrences.js';
import {berlinOffsetMinutes} from './berlinTime.js';

export function m5EntryHistoryKnown(rows,from,at,sessionConfigs=[],instrument) {
 if(!Number.isFinite(from) || !Number.isFinite(at) || from>at)return false;
 const end=Math.floor(at/300)*300,start=Math.ceil(from/300)*300;
 // Konfigurierte ignorierte Intervalle und lange Wochenendpausen benötigen keine Handelskerzen.
 const wall=berlinWallTime;
 const utc=(local,edge)=>{
  const offsets=[...new Set([-86400,0,86400].map(delta=>berlinOffsetMinutes((local+delta)*1000)))];
  const candidates=offsets.map(offset=>local-offset*60).filter(sec=>wall(sec)===local);
  return candidates.length?(edge==='start'?Math.max(...candidates):Math.min(...candidates)):null;
 };
 const closures=sessionConfigs.filter(s=>s.instrument===instrument && (s.ignoreLiquidity
  || s.toMinutes-s.fromMinutes>=2880 && s.days?.includes(5)))
  .flatMap(s=>sessionOccurrences(s.fromMinutes,s.toMinutes,wall(start)-Math.min(7*86400,Math.max(86400,(s.toMinutes-s.fromMinutes)*60)),wall(end),0,s.days))
  // Beide Grenzen einzeln auf der Berliner Kalenderachse umrechnen; DST ändert die Dauer.
  .map(r=>({startSec:utc(r.startSec,'start'),endSec:utc(r.endSec,'end')}))
  .filter(r=>Number.isFinite(r.startSec) && Number.isFinite(r.endSec) && r.endSec>r.startSec)
  .sort((a,b)=>a.startSec-b.startSec);
 const covered=(from,to)=>{
  let cursor=from;
  for(const range of closures){if(range.startSec>cursor)break;if(range.endSec>cursor)cursor=Math.min(to,range.endSec);if(cursor===to)return true;}
  return cursor===to;
 };
 let next=start;
 for(const c of rows){
  if(c.time<start || c.time+300>end)continue;
  if(c.time<next || ![c.open,c.high,c.low,c.close].every(Number.isFinite) || c.low>c.high)return false;
  if(c.time>next && !covered(next,c.time))return false;
  next=c.time+300;
 }
 return next===end || covered(next,end);
}
