// Bewusster Deno-Spiegel des Browserhelpers; nur das TS1.1-Opt-in nutzt diese Bestätigungsregeln.
import {liquidityTouch} from './liquidity.ts';
import {businessSecondsBetween} from './ageTier.ts';
import type {Candle} from './orderBlocks.ts';
import type {LiquidityLevel} from './liquidity.ts';
import {tradeSetupSweepSourceKey as sweepSourceKey} from './tradeSetupSourceSnapshot.js';
export {sweepSourceKey};
export const TRADE_SETUP_M5_FRACTAL_PERIOD=5;

export interface OrderBlockSweepSource extends LiquidityLevel {
 dir:1|-1;
 sourceKind:'orderBlock';sourceStartTime:number;sourceKnownAt:number;sourceDirection:1|-1;
 sourceTop:number;sourceBottom:number;
}
type SourceOb={dir:1|-1;top:number;bottom:number;startTime:number};
type SweepLevel=LiquidityLevel&{dir:1|-1;sourceKind?:string};

export function orderBlockRecognitionTimes(candles:Candle[]) {
 return new Map(candles.slice(0,-1).map((c,i)=>[c.time,candles[i+1].time+300]));
}

export function orderBlockSweepSources(obs:SourceOb[],candles:Candle[],dir:1|-1,evaluatedAt:number):OrderBlockSweepSource[] {
 const recognition=orderBlockRecognitionTimes(candles);
 return obs.filter(ob=>ob.dir===-dir&&(recognition.get(ob.startTime)??Infinity)<=evaluatedAt).flatMap(ob=>{
  const knownAt=recognition.get(ob.startTime)!,price=dir===1?ob.top:ob.bottom;
  const touch=candles.find(c=>!c.ignored&&c.time>=knownAt&&c.time+300<=evaluatedAt&&liquidityTouch(c,price,dir));
  return touch?[{sourceKind:'orderBlock' as const,sourceStartTime:ob.startTime,sourceKnownAt:knownAt,
   sourceDirection:ob.dir,sourceTop:ob.top,sourceBottom:ob.bottom,
   price,dir,pivotTime:ob.startTime,touched:true,touchedTime:touch.time,endTime:touch.time}]:[];
 });
}

export function evaluateSweepConfirmation(level:SweepLevel,candles:Candle[],evaluatedAt:number,timeframe='5M',liquidityLevels:SweepLevel[]=[] ) {
 if(timeframe!=='5M'||level.sourceKind==='orderBlock')return {status:'valid',validUntil:null};
 const rows=candles.filter(c=>!c.ignored&&c.time+300<=evaluatedAt);
 const first=level.touchedTime==null?null:rows.find(c=>c.time>=level.touchedTime!&&c.time<level.touchedTime!+300
  &&liquidityTouch(c,level.price,level.dir));
 if(!first)return {status:'unknown',reason:'sweepCandleMissing'};
 const indices=new Map(rows.map((c,i)=>[c.time,i]));
 // Erst ein zweiter bestätigter LS löst die Quelle ab, kein weiterer Docht derselben Bewegung.
 const replacements=liquidityLevels.flatMap(next=>{
  const index=indices.get(next.pivotTime),knownAt=index===undefined?null:rows[index+TRADE_SETUP_M5_FRACTAL_PERIOD]?.time+300;
  if(next.sourceKind==='orderBlock'||next.dir!==level.dir||!next.touched||next.touchedTime==null
   ||level.touchedTime==null||next.pivotTime<=level.touchedTime||next.touchedTime<=level.touchedTime||next.touchedTime+300>evaluatedAt
   ||knownAt==null||!Number.isFinite(knownAt)||knownAt>next.touchedTime+300
   ||!(level.dir===1?next.price>level.price:next.price<level.price))return [];
  const sourceKey=sweepSourceKey(next,'5M');
  return [{level:next,knownAt,sourceKey,validUntil:next.touchedTime+300}];
 }).sort((a,b)=>a.validUntil-b.validUntil||a.level.pivotTime-b.level.pivotTime);
 if(replacements.length)return {status:'superseded',reason:'newerConfirmedM5Sweep',validUntil:replacements[0].validUntil,supersededBy:replacements[0]};
 const window=rows.filter(c=>c.time>=first.time);
 if(window.some((c,i)=>i&&businessSecondsBetween(window[i-1].time,c.time)>300)
  ||window.at(-1)!.time+300<Math.floor(evaluatedAt/300)*300)
  return {status:'unknown',reason:'sweepCoverageMissing',validUntil:null};
 return {status:'valid',validUntil:null,knownAt:first.time+300};
}
