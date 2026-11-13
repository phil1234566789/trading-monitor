import {detectOrderBlocks,candleInvalidatesOrderBlock} from './orderBlockDetection.js';
import {obMinimum} from './instrumentConfig.js';
import {orderBlockRecognitionTimes} from './orderBlockRecognitionTime.js';
import {closedChecklistCandles} from './tradeSetupChecklistTimeBasis.js';
import {evaluateOrderBlockMitigation} from './orderBlockMitigation.js';
import {m1FvgEntryCandidates} from './m1FvgEntrySelection.js';
import {m1FvgEntrySequence,advanceM1FvgEntrySequence,m1FvgSequenceResult} from './m1FvgEntrySequence.js';
import {evaluateDoubleOrderBlockOutcome} from './doubleOrderBlockOutcome.js';
import {measureOrderBlockPenetration} from './orderBlockPenetration.js';

export const DOUBLE_ORDER_BLOCK_VERSION='latest-reaction-first-m1-fvg-v1';

function entriesFor(reaction,orderBlock,m1,candidates,evaluatedAt,instrument){
 const fvg=candidates.find(f=>f.candleTime===reaction.fvg.candleTime&&f.recognizedAt===reaction.fvg.recognizedAt);
 const direction=orderBlock.dir===1?'long':'short',stopPrice=direction==='long'?orderBlock.bottom:orderBlock.top;
 return Object.fromEntries([['a','immediate'],['b','retestReaction']].map(([variant,mode])=>{
  if(!fvg)return [variant,{variant,status:'unknown',reason:'missingFvg'}];
  const state=m1FvgEntrySequence(fvg,mode);
  for(const candle of m1){advanceM1FvgEntrySequence(state,candle);if(state.result)break;}
  const entry={...m1FvgSequenceResult(state),variant,stopPrice};
  if(entry.status==='ready'){
   if(m1.some(c=>c.time>=reaction.retest.candleTime&&c.time+60<=entry.entryTime&&!c.ignored&&candleInvalidatesOrderBlock(c,orderBlock)))
    return [variant,{variant,status:'invalid',reason:'m5OrderBlockBroken',stopPrice}];
   const outcome=evaluateDoubleOrderBlockOutcome({direction,...entry,candles:m1,evaluatedAt,instrument});
   Object.assign(entry,{targetPrice:outcome.targetPrice,outcome});
  }
  return [variant,entry];
 }));
}

// Sämtliche Partner werden geprüft: benachbarte/überlappende OBs dürfen sich nicht gegenseitig verdrängen.
export function detectDoubleOrderBlocks({m5Candles=[],m1Candles=[],instrument='XAUUSD',evaluatedAt}){
 const m5=closedChecklistCandles(m5Candles,'5m',evaluatedAt),m1=closedChecklistCandles(m1Candles,'1m',evaluatedAt);
 const result={version:DOUBLE_ORDER_BLOCK_VERSION,status:m1.length?'ready':'unknown',pairs:[],stats:{m5Bars:m5.length,m1Bars:m1.length,orderBlocks:0,mitigations:0,pairChecks:0}};
 if(!Number.isFinite(evaluatedAt)||!m5.length||!m1.length)return result;
 const recognition=orderBlockRecognitionTimes(m5,'5m'),zones=detectOrderBlocks(m5,'5m',true,obMinimum(instrument,'5m'));
 const candidates=m1FvgEntryCandidates(m1,evaluatedAt),qualified=[];
 result.stats.orderBlocks=zones.length;
 for(const zone of zones){
  const orderBlock={...zone,recognizedAt:recognition.get(zone.startTime),timeframe:'5M'};
  const reaction=evaluateOrderBlockMitigation({orderBlock,m1Candles:m1,fromTime:orderBlock.recognizedAt,evaluatedAt});
  result.stats.mitigations++;
  if(!reaction.retest||!reaction.fvg)continue;
  const invalidation=m1.find(c=>!c.ignored&&c.time>=orderBlock.recognizedAt&&candleInvalidatesOrderBlock(c,orderBlock));
  const entries=entriesFor(reaction,orderBlock,m1,candidates,evaluatedAt,instrument);
  if(entries.a.status!=='ready')continue;
  const penetration=measureOrderBlockPenetration(orderBlock,orderBlock.dir===1?'long':'short',
   m1.filter(c=>c.time>=reaction.retest.candleTime&&c.time+60<=reaction.fvg.recognizedAt));
  const m5Invalidation=m5.find(c=>!c.ignored&&c.time>=orderBlock.recognizedAt&&candleInvalidatesOrderBlock(c,orderBlock));
  // Ein späterer Bruch löscht den vorher bestätigten Vergleichsbeleg nicht aus dem Verlauf.
  const m5Confirmation=zone.touchedTime==null?null:zones.find(other=>other.dir===zone.dir&&other.startTime>zone.touchedTime
   &&recognition.get(other.startTime)<=(m5Invalidation?.time??Infinity));
  qualified.push({orderBlock:reaction.retest.orderBlock,reaction,entries,penetration,invalidatedAt:invalidation?.time??Infinity,
   m5ReactionKnownAt:m5Confirmation?recognition.get(m5Confirmation.startTime):null});
 }
 for(let second=1;second<qualified.length;second++){
  const partners=[];let latestReaction=-Infinity;
  for(let first=0;first<second;first++){
  result.stats.pairChecks++;
  const a=qualified[first],b=qualified[second],sign=b.orderBlock.dir;
  if(a.orderBlock.dir!==sign||a.orderBlock.startTime>=b.orderBlock.startTime
   ||(b.orderBlock.top-a.orderBlock.top)*sign<=0||(b.orderBlock.bottom-a.orderBlock.bottom)*sign<=0
   ||a.reaction.fvg.recognizedAt>b.reaction.retest.candleTime||a.invalidatedAt<b.reaction.retest.candleTime)continue;
  const firstReactionAt=a.reaction.fvg.recognizedAt;
  if(firstReactionAt<latestReaction)continue;
  if(firstReactionAt>latestReaction){partners.length=0;latestReaction=firstReactionAt;}
  const recognizedAt=Math.max(a.reaction.fvg.recognizedAt,b.entries.a.entryTime);
  // Der M5-Reteststatus ist ein gröberer Vergleichsbeleg, kein Ersatz für die vorhandene M1-Mitigation.
  partners.push({id:`dob:${instrument}:${sign}:${a.orderBlock.startTime}:${b.orderBlock.startTime}`,
   instrument,direction:sign===1?'long':'short',firstOrderBlock:a.orderBlock,secondOrderBlock:b.orderBlock,
   firstRetest:a.reaction.retest,secondRetest:b.reaction.retest,firstReaction:a.reaction.fvg,secondReaction:b.reaction.fvg,
   firstPenetration:a.penetration,secondPenetration:b.penetration,
   firstM5ReactionKnownAt:a.m5ReactionKnownAt,firstReactionSource:'m1',recognizedAt,entries:b.entries});
  }
  // Gleichzeitige Reaktionen überlappender Zonen sind getrennte belegte Partner, kein Zeit-Tiebreaker.
  result.pairs.push(...partners);
 }
 return result;
}

export function doubleOrderBlockDisplay(pair,evaluatedAt){
 if(!pair||pair.recognizedAt>evaluatedAt)return {visible:false,tone:'neutral',variants:{}};
 const variants=Object.fromEntries(Object.entries(pair.entries).map(([key,entry])=>{
  if(entry.status!=='ready'||entry.entryTime>evaluatedAt)return [key,entry.status==='ready'?'pending':entry.status];
  const outcome=entry.outcome;
  return [key,outcome?.recognizedAt!=null&&outcome.recognizedAt<=evaluatedAt?outcome.status:
   outcome?.status==='unknown'&&outcome.unavailableAt<=evaluatedAt?'unknown':'open'];
 }));
 const active=Object.entries(pair.entries).filter(([,entry])=>entry.status==='ready'&&entry.entryTime<=evaluatedAt);
 return {visible:true,tone:active.length&&active.every(([key])=>variants[key]==='loss')?'red':'gold',variants};
}
