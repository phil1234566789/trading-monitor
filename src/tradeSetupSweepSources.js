import {liquidityTouch} from './liquidityDetection.js';
import {businessSecondsBetween} from './chartTimeUtils.js';
import {orderBlockRecognitionTimes} from './orderBlockRecognitionTime.js';
import {TRADE_SETUP_M5_FRACTAL_PERIOD} from './priceChartConstants.js';
import {tradeSetupSweepSourceKey as sweepSourceKey} from '../supabase/functions/_shared/tradeSetupSourceSnapshot.js';
export {sweepSourceKey};

export function orderBlockSweepSources(obs,candles,dir,evaluatedAt) {
 const recognition=orderBlockRecognitionTimes(candles,'5m');
 return obs.filter(ob=>ob.dir===-dir&&recognition.get(ob.startTime)<=evaluatedAt).flatMap(ob=>{
  const knownAt=recognition.get(ob.startTime),price=dir===1?ob.top:ob.bottom;
  const touch=candles.find(c=>!c.ignored&&c.time>=knownAt&&c.time+300<=evaluatedAt&&liquidityTouch(c,price,dir));
  return touch?[{sourceKind:'orderBlock',sourceStartTime:ob.startTime,sourceKnownAt:knownAt,
   sourceDirection:ob.dir,sourceTop:ob.top,sourceBottom:ob.bottom,
   price,dir,pivotTime:ob.startTime,touched:true,touchedTime:touch.time,endTime:touch.time}]:[];
 });
}

export function confirmedOrderBlockSweepSource(level,obs,candles,evaluatedAt) {
 const keys=['sourceKind','sourceStartTime','sourceKnownAt','sourceDirection','sourceTop','sourceBottom',
  'price','dir','pivotTime','touchedTime'];
 return orderBlockSweepSources(obs,candles,level.dir,evaluatedAt)
  .some(source=>keys.every(key=>source[key]===level[key]));
}

export function evaluateSweepConfirmation(level,candles,evaluatedAt,timeframe='5M',liquidityLevels=[]) {
 if(timeframe!=='5M'||level.sourceKind==='orderBlock')return {status:'valid',validUntil:null};
 const rows=candles.filter(c=>!c.ignored&&c.time+300<=evaluatedAt);
 const first=rows.find(c=>c.time>=level.touchedTime&&c.time<level.touchedTime+300
  &&liquidityTouch(c,level.price,level.dir));
 if(!first)return {status:'unknown',reason:'sweepCandleMissing'};
 const indices=new Map(rows.map((c,i)=>[c.time,i]));
 // Ein tieferer/höherer Docht derselben Bewegung ist kein zweiter bestätigter LS.
 const replacements=liquidityLevels.flatMap(next=>{
  const index=indices.get(next.pivotTime),knownAt=index===undefined?null:rows[index+TRADE_SETUP_M5_FRACTAL_PERIOD]?.time+300;
  if(next.sourceKind==='orderBlock'||next.dir!==level.dir||!next.touched||!Number.isFinite(next.touchedTime)
   ||next.pivotTime<=level.touchedTime||next.touchedTime<=level.touchedTime||next.touchedTime+300>evaluatedAt
   ||!Number.isFinite(knownAt)||knownAt>next.touchedTime+300
   ||!(level.dir===1?next.price>level.price:next.price<level.price))return [];
  return [{level:next,knownAt,sourceKey:sweepSourceKey(next,'5M'),validUntil:next.touchedTime+300}];
 }).sort((a,b)=>a.validUntil-b.validUntil||a.level.pivotTime-b.level.pivotTime);
 if(replacements.length)return {status:'superseded',reason:'newerConfirmedM5Sweep',validUntil:replacements[0].validUntil,supersededBy:replacements[0]};
 const window=rows.filter(c=>c.time>=first.time);
 if(window.some((c,i)=>i&&businessSecondsBetween(window[i-1].time,c.time)>300)
  ||!window.length||window.at(-1).time+300<Math.floor(evaluatedAt/300)*300)
  return {status:'unknown',reason:'sweepCoverageMissing',validUntil:null};
 return {status:'valid',validUntil:null,knownAt:first.time+300};
}
