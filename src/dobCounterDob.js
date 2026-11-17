import {detectDoubleOrderBlocks} from './doubleOrderBlocks.js';

// DOB-Setup v3 (Philip, Merkmal-Labor): kein Trade, wenn zwischen dem Retest der Kraftquelle (Start der letzten Touch-Episode
// vor OB1) und dem Entry ein DOB-Paar in Gegenrichtung erkannt wurde. Tot (zählt nicht): Ein M1-Schluss vor dem Entry lag jenseits
// der fernen OB2-Kante des Gegen-DOBs (bärisch über Oberkante, bullisch unter Unterkante). Paare, deren Routen der Indikator
// alle verwirft, liefert detectDoubleOrderBlocks gar nicht erst.
export const DOB_COUNTER_DOB_LOOKBACK_SECONDS=2*86400;

const lowerBound=(rows,t)=>{let lo=0,hi=rows.length;while(lo<hi){const m=(lo+hi)>>1;if(rows[m].time<t)lo=m+1;else hi=m;}return lo;};
function counterDead(pair,m1Candles,entryTime){
 const short=pair.direction==='short',edge=short?pair.secondOrderBlock.top:pair.secondOrderBlock.bottom;
 for(let i=lowerBound(m1Candles,pair.recognizedAt);i<m1Candles.length&&m1Candles[i].time+60<=entryTime;i++)
  if(short?m1Candles[i].close>edge:m1Candles[i].close<edge)return true;
 return false;
}

// dob = detectDoubleOrderBlocks am Entry; je OB2 einmal gezählt. live = ohne tote (m1Candles nötig).
export function dobCounterDobs(dob,direction,fromTime,entryTime,m1Candles=null){
 const opposite=(dob?.pairs??[]).filter(p=>p.direction!==direction&&p.recognizedAt>fromTime&&p.recognizedAt<=entryTime);
 const byOb2=new Map(opposite.map(p=>[p.secondOrderBlock.startTime,p]));
 return {count:byOb2.size,...(m1Candles?{liveCount:[...byOb2.values()].filter(p=>!counterDead(p,m1Candles,entryTime)).length}:{})};
}

export const dobSourceRetestTime=setup=>setup.sourceOfStrength?.retestAgeSeconds==null?null
 :setup.chart.firstOrderBlockStart-setup.sourceOfStrength.retestAgeSeconds;

// Gate für checkDobTradeSetup (input.counterDobGate): erkennt Gegen-DOBs auf eigenen 2 Tagen bis zum Entry, weil der
// Quellen-Retest vor dem Live-Fenster liegen kann. m5/m1 session-markiert und bis mindestens zum Entry. Je Entry gecacht.
export function createDobCounterDobGate({m5Candles,m1Candles,instrument='XAUUSD'},{liveOnly=true}={}){
 const cache=new Map();
 const dobAt=entryTime=>{
  if(!cache.has(entryTime)){
   const from=entryTime-DOB_COUNTER_DOB_LOOKBACK_SECONDS,slice=rows=>rows.slice(lowerBound(rows,from),lowerBound(rows,entryTime));
   cache.set(entryTime,detectDoubleOrderBlocks({instrument,evaluatedAt:entryTime,m5Candles:slice(m5Candles),m1Candles:slice(m1Candles)}));
  }
  return cache.get(entryTime);
 };
 return setup=>{
  const from=dobSourceRetestTime(setup);
  if(setup.entryTime==null||from==null)return null;
  const counter=dobCounterDobs(dobAt(setup.entryTime),setup.direction,from,setup.entryTime,m1Candles);
  return {...counter,rejectReason:(liveOnly?counter.liveCount:counter.count)>0?'counterDob':null};
 };
}
