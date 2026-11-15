import {detectOrderBlocks,candleInvalidatesOrderBlock} from './orderBlockDetection.js';
import {obMinimum,instrumentConfig} from './instrumentConfig.js';
import {orderBlockRecognitionTimes} from './orderBlockRecognitionTime.js';
import {closedChecklistCandles} from './tradeSetupChecklistTimeBasis.js';
import {createOrderBlockReactionContext,evaluateOrderBlockReaction,exactRetestAnchor,NEAR_TOUCH_FRACTION,ENTRY_B_MAX_ORDER_BLOCK_DEPTH} from './orderBlockReaction.js';
import {evaluateDoubleOrderBlockOutcome} from './doubleOrderBlockOutcome.js';
import {orderBlockRetestHoldHistory,orderBlockRetestHoldAt} from './orderBlockRetestHold.js';
import {evaluateDoubleOrderBlockRetestDay} from './doubleOrderBlockRetestDay.js';
import {evaluateDoubleOrderBlockPriceGap} from './doubleOrderBlockPriceGap.js';

export const DOUBLE_ORDER_BLOCK_VERSION='m1-reaction-exact-ob1-near10-ob2-entry-sl-hold-sameday-xau-gap2-v7';

// Nur Routen mit vollständigem Entry-Tupel bekommen ein Outcome; die Statuswörter bleiben die des Renderings.
function pairEntries(reaction,direction,m1,evaluatedAt,instrument){
 return Object.fromEntries(Object.entries(reaction.routes).map(([variant,route])=>{
  if(route.status!=='entry')return [variant,{variant,status:route.status==='rejected'?'invalid':route.status,reason:route.reason,knownAt:route.knownAt??null}];
  const entry={variant,status:'ready',entryTime:route.entryTime,entryPrice:route.entryPrice,stopPrice:route.stopLoss,
   stopAnchor:route.stopAnchor,confirmationCandleTime:route.confirmationCandleTime};
  const outcome=evaluateDoubleOrderBlockOutcome({direction,...entry,candles:m1,evaluatedAt,instrument});
  return [variant,{...entry,targetPrice:outcome.targetPrice,outcome}];
 }));
}

// Hold-Anker: exakter OB1-Retest, wenn er vor dem OB2-Retest bekannt ist, sonst die Near-Reaktion selbst.
// Ein OB1-Bruch vor dem OB2-Retest schwemmt immer auch diesen Anker aus; der Hold-Gate deckt ihn mit ab.
export function firstRetestHoldAnchor(exactAnchor,secondRetestAt){
 return exactAnchor&&exactAnchor.fromTime<=secondRetestAt?'exact':'near';
}
function firstRetestHoldHistory(context,first,secondRetestAt,m1,evaluatedAt){
 first.exactAnchor??=exactRetestAnchor(context,first.orderBlock,first.reaction)??false;
 const kind=firstRetestHoldAnchor(first.exactAnchor,secondRetestAt),key=`${kind}Hold`;
 const anchor=kind==='exact'?first.exactAnchor:{fromTime:first.reaction.fvg.recognizedAt,price:first.reaction.penetration.extremePrice};
 first[key]??=orderBlockRetestHoldHistory({candles:m1,direction:first.orderBlock.dir===1?'long':'short',
  anchorPrice:anchor.price,fromTime:anchor.fromTime,evaluatedAt,instrument:context.instrument});
 return first[key];
}

// Ablations-Schalter: Near-Touch je OB-Rolle, optionales M5-Tiefen-Gate je Rolle, SL-Regel (scripts/dobAblation.mjs).
// Default nearTouch 'second': Near-Touch-Reaktionen auf OB1 waren in Okt und Nov die schwächsten Zusatz-Trades.
export const DOUBLE_ORDER_BLOCK_DEFAULT_OPTIONS=Object.freeze({nearTouch:'second',maxRetestDepth:Object.freeze({first:null,second:null}),stopRule:'internalFvg'});
const depthPasses=(reaction,maximum)=>maximum==null||reaction.penetration.status==='ready'&&reaction.penetration.maxPenetrationFraction<=maximum;

// Sämtliche Partner werden geprüft: benachbarte/überlappende OBs dürfen sich nicht gegenseitig verdrängen.
export function detectDoubleOrderBlocks({m5Candles=[],m1Candles=[],instrument='XAUUSD',evaluatedAt,options={}}){
 const {nearTouch,maxRetestDepth,stopRule}={...DOUBLE_ORDER_BLOCK_DEFAULT_OPTIONS,...options};
 const m5=closedChecklistCandles(m5Candles,'5m',evaluatedAt),m1=closedChecklistCandles(m1Candles,'1m',evaluatedAt);
 const result={version:DOUBLE_ORDER_BLOCK_VERSION,status:m1.length?'ready':'unknown',pairs:[],
  policy:{reaction:'first exact touch (OB1) / touch or near-touch (OB2), then first same-direction M1 FVG; M5 far edge broken first = false',nearTouchFraction:NEAR_TOUCH_FRACTION,
   entryBMaxOrderBlockDepth:ENTRY_B_MAX_ORDER_BLOCK_DEPTH,stop:'open internal M1 FVG at entry = M5 far edge, otherwise unknown',
   firstRetestHoldThrough:'secondReactionKnownAt',retestDay:'Europe/Berlin calendar date',maxPositiveZoneGap:instrumentConfig(instrument).dobMaxPositiveZoneGap,
   options:{nearTouch,maxRetestDepth,stopRule}},
  stats:{m5Bars:m5.length,m1Bars:m1.length,orderBlocks:0,reactionTrue:0,reactionFalse:0,reactionUnknown:0,pairChecks:0,
   firstHoldRejected:0,firstHoldUnknown:0,differentRetestDays:0,priceGapRejected:0,pairsWithoutEntry:0}};
 if(!Number.isFinite(evaluatedAt)||!m5.length||!m1.length)return result;
 const recognition=orderBlockRecognitionTimes(m5,'5m'),zones=detectOrderBlocks(m5,'5m',true,obMinimum(instrument,'5m'));
 const context=createOrderBlockReactionContext(m1,evaluatedAt,instrument,{stopRule}),qualified=[];
 const holdHistory=(first,secondRetestAt)=>firstRetestHoldHistory(context,first,secondRetestAt,m1,evaluatedAt);
 result.stats.orderBlocks=zones.length;
 for(const zone of zones){
  const orderBlock={...zone,recognizedAt:recognition.get(zone.startTime),timeframe:'5M'};
  const near=nearTouch==='none'?null:evaluateOrderBlockReaction(context,orderBlock);
  const exact=nearTouch==='both'?null:evaluateOrderBlockReaction(context,orderBlock,{nearTouch:false});
  const [firstReaction,secondReaction]=nearTouch==='second'?[exact,near]:[near??exact,near??exact];
  result.stats[`reaction${secondReaction.state[0].toUpperCase()}${secondReaction.state.slice(1)}`]++;
  const asFirst=firstReaction.state==='true'&&depthPasses(firstReaction,maxRetestDepth.first)?{orderBlock,reaction:firstReaction}:null;
  const asSecond=secondReaction.state==='true'&&depthPasses(secondReaction,maxRetestDepth.second)?{orderBlock,reaction:secondReaction}:null;
  if(!asFirst&&!asSecond)continue;
  const m5Invalidation=m5.find(c=>!c.ignored&&c.time>=orderBlock.recognizedAt&&candleInvalidatesOrderBlock(c,orderBlock));
  // Ein späterer Bruch löscht den vorher bestätigten Vergleichsbeleg nicht aus dem Verlauf.
  const m5Confirmation=zone.touchedTime==null?null:zones.find(other=>other.dir===zone.dir&&other.startTime>zone.touchedTime
   &&recognition.get(other.startTime)<=(m5Invalidation?.time??Infinity));
  if(asFirst)asFirst.m5ReactionKnownAt=m5Confirmation?recognition.get(m5Confirmation.startTime):null;
  qualified.push({orderBlock,asFirst,asSecond});
 }
 for(let second=1;second<qualified.length;second++){
  const partners=[];let latestReaction=-Infinity;
  for(let first=0;first<second;first++){
  result.stats.pairChecks++;
  const a=qualified[first].asFirst,b=qualified[second].asSecond,sign=qualified[second].orderBlock.dir;
  if(!a||!b||a.orderBlock.dir!==sign||a.orderBlock.startTime>=b.orderBlock.startTime
   ||(b.orderBlock.top-a.orderBlock.top)*sign<=0||(b.orderBlock.bottom-a.orderBlock.bottom)*sign<=0
   ||a.reaction.fvg.recognizedAt>b.reaction.contact.candleTime)continue;
  const priceGap=evaluateDoubleOrderBlockPriceGap(a.orderBlock,b.orderBlock,sign,instrument);
  if(priceGap.status!=='passed'){result.stats.priceGapRejected++;continue;}
  if(evaluateDoubleOrderBlockRetestDay(a.reaction.contact.candleTime,b.reaction.contact.candleTime).status!=='passed'){
   result.stats.differentRetestDays++;continue;
  }
  const firstRetestHold=orderBlockRetestHoldAt(holdHistory(a,b.reaction.contact.candleTime),b.reaction.fvg.recognizedAt);
  if(firstRetestHold.status!=='passed'){
   result.stats[firstRetestHold.status==='failed'?'firstHoldRejected':'firstHoldUnknown']++;
   continue;
  }
  const firstReactionAt=a.reaction.fvg.recognizedAt;
  if(firstReactionAt<latestReaction)continue;
  if(firstReactionAt>latestReaction){partners.length=0;latestReaction=firstReactionAt;}
  b.entries??=pairEntries(b.reaction,sign===1?'long':'short',m1,evaluatedAt,instrument);
  const retest=({contact})=>({candleTime:contact.candleTime,recognizedAt:contact.knownAt,contact:contact.status});
  // Der M5-Reteststatus ist ein gröberer Vergleichsbeleg, kein Ersatz für die M1-Reaktion.
  partners.push({id:`dob:${instrument}:${sign}:${a.orderBlock.startTime}:${b.orderBlock.startTime}`,
   instrument,direction:sign===1?'long':'short',firstOrderBlock:a.orderBlock,secondOrderBlock:b.orderBlock,
   firstRetest:retest(a.reaction),secondRetest:retest(b.reaction),firstReaction:a.reaction.fvg,secondReaction:b.reaction.fvg,
   firstPenetration:a.reaction.penetration,secondPenetration:b.reaction.penetration,firstRetestHold,priceGap,
   firstM5ReactionKnownAt:a.m5ReactionKnownAt,firstReactionSource:'m1',recognizedAt:b.reaction.fvg.recognizedAt,entries:b.entries});
  }
  // Gleichzeitige Reaktionen überlappender Zonen sind getrennte belegte Partner, kein Zeit-Tiebreaker.
  // Ein Paar ohne möglichen Entry (beide Routen invalid/unknown) trägt keinen Trade und wird nur gezählt.
  if(partners.length&&!Object.values(qualified[second].asSecond.entries).some(e=>e.status==='ready'||e.status==='pending'))result.stats.pairsWithoutEntry+=partners.length;
  else result.pairs.push(...partners);
 }
 return result;
}

export function doubleOrderBlockDisplay(pair,evaluatedAt){
 if(!pair||pair.recognizedAt>evaluatedAt)return {visible:false,tone:'neutral',variants:{}};
 const variants=Object.fromEntries(Object.entries(pair.entries).map(([key,entry])=>{
  if(entry.status!=='ready')return [key,entry.knownAt!=null&&entry.knownAt>evaluatedAt?'pending':entry.status];
  if(entry.entryTime>evaluatedAt)return [key,'pending'];
  const outcome=entry.outcome;
  return [key,outcome?.recognizedAt!=null&&outcome.recognizedAt<=evaluatedAt?outcome.status:
   outcome?.status==='unknown'&&outcome.unavailableAt<=evaluatedAt?'unknown':'open'];
 }));
 const active=Object.entries(pair.entries).filter(([,entry])=>entry.status==='ready'&&entry.entryTime<=evaluatedAt);
 return {visible:true,tone:active.length&&active.every(([key])=>variants[key]==='loss')?'red':'gold',variants};
}
