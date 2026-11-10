import {candleTouchesOrderBlock} from './orderBlockDetection.js';

export const ENTRY_PATTERN_2_OB_RULE_VERSION='ob-beyond-ls-max-depth-until-entry-v1';
export const ENTRY_PATTERN_2_MAX_OB_RETEST_FRACTION=.5;
export const ENTRY_PATTERN_2_OB_RULE=Object.freeze({version:ENTRY_PATTERN_2_OB_RULE_VERSION,maxRetestFraction:ENTRY_PATTERN_2_MAX_OB_RETEST_FRACTION});
const validZone=(ob,direction)=>['long','short'].includes(direction)&&ob?.dir===(direction==='long'?1:-1)
  &&Number.isFinite(ob?.top)&&Number.isFinite(ob?.bottom)&&ob.top>ob.bottom;

export function entryPattern2OrderBlockPlacement({orderBlock,level,direction,evaluatedAt,sourceKnownAt}) {
  const recognizedAt=Math.max(orderBlock?.recognizedAt,level?.recognizedAt ?? sourceKnownAt);
  const result={status:'unknown',ruleVersion:ENTRY_PATTERN_2_OB_RULE_VERSION,recognizedAt,levelPrice:level?.price};
  if(!validZone(orderBlock,direction)||!Number.isFinite(level?.price)||!Number.isFinite(recognizedAt)
    ||!Number.isFinite(evaluatedAt)||recognizedAt>evaluatedAt)return result;
  return {...result,status:(direction==='long'?orderBlock.top<level.price:orderBlock.bottom>level.price)?'passed':'unmet'};
}

export function evaluateEntryPattern2OrderBlockDepth({orderBlock,direction,retest,candles=[],entryAt,evaluatedAt}) {
  const result={status:'unknown',ruleVersion:ENTRY_PATTERN_2_OB_RULE_VERSION,
    maxRetestFraction:ENTRY_PATTERN_2_MAX_OB_RETEST_FRACTION,recognizedAt:entryAt,
    fromTime:retest?.candleTime,checkedThrough:entryAt,maxPenetrationFraction:null,firstBreachTime:null};
  if(!validZone(orderBlock,direction)||!Number.isFinite(entryAt)||!Number.isFinite(evaluatedAt)||entryAt>evaluatedAt
    ||!Number.isFinite(retest?.candleTime)||retest.recognizedAt!==retest.candleTime+60
    ||!Number.isFinite(orderBlock.recognizedAt)||orderBlock.recognizedAt>retest.candleTime
    ||retest.recognizedAt>entryAt)return result;
  // Die Entry-Zeit ist der Schluss der Bestätigung: ihre Open-Time zählt, die folgende Kerze nicht.
  const rows=candles.filter(c=>c.time>=retest.candleTime&&c.time+60<=entryAt);
  const first=rows[0];
  if(first?.time!==retest.candleTime||first.ignored||!candleTouchesOrderBlock(first,orderBlock))return result;
  let expected=retest.candleTime,complete=true,maxDepth=-Infinity,firstBreachTime=null;
  const height=orderBlock.top-orderBlock.bottom;
  const tolerance=Number.EPSILON*Math.max(Math.abs(orderBlock.top),Math.abs(orderBlock.bottom),1)*8;
  for(const candle of rows){
    if(candle.time!==expected)complete=false;
    expected=candle.time+60;
    if(candle.ignored||!['open','high','low','close'].every(key=>Number.isFinite(candle[key]))
      ||candle.low>Math.min(candle.open,candle.close)||candle.high<Math.max(candle.open,candle.close)){
      complete=false;continue;
    }
    const depth=direction==='long'?orderBlock.top-candle.low:candle.high-orderBlock.bottom;
    maxDepth=Math.max(maxDepth,depth);
    if(depth-height*ENTRY_PATTERN_2_MAX_OB_RETEST_FRACTION>tolerance&&firstBreachTime===null)firstBreachTime=candle.time;
  }
  complete=complete&&expected===entryAt;
  return {...result,status:firstBreachTime!==null?'unmet':complete?'passed':'unknown',
    maxPenetrationFraction:Number.isFinite(maxDepth)?maxDepth/height:null,firstBreachTime};
}
