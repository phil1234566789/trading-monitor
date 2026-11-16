import {detectOrderBlocks,candleInvalidatesOrderBlock} from './orderBlockDetection.js';
import {obMinimum,instrumentConfig} from './instrumentConfig.js';
import {orderBlockRecognitionTimes} from './orderBlockRecognitionTime.js';
import {closedChecklistCandles} from './tradeSetupChecklistTimeBasis.js';
import {createOrderBlockReactionContext,reactionOrSkip,exactRetestAnchor,NEAR_TOUCH_FRACTION,TOUCH_TOLERANCE_FRACTION,ENTRY_B_MAX_ORDER_BLOCK_DEPTH} from './orderBlockReaction.js';
import {evaluateDoubleOrderBlockOutcome} from './doubleOrderBlockOutcome.js';
import {orderBlockRetestHoldHistory,orderBlockRetestHoldAt} from './orderBlockRetestHold.js';
import {evaluateDoubleOrderBlockRetestDay} from './doubleOrderBlockRetestDay.js';
import {evaluateDoubleOrderBlockPriceGap} from './doubleOrderBlockPriceGap.js';

export const DOUBLE_ORDER_BLOCK_VERSION='m1-reaction-exact-session-entry-sl-hold-sameday-xau-gap2-retest-extreme-touch2-opponent-terminal-entry-v11';

// Nur vollständige Entries bekommen ein Outcome; nach A bleibt B ausdrücklich skipped, nicht pending oder unknown.
function pairEntries(reaction,direction,m1,evaluatedAt,instrument){
 return Object.fromEntries(Object.entries(reaction.routes).map(([variant,route])=>{
  if(route.status!=='entry')return [variant,{variant,status:route.status==='rejected'?'invalid':route.status,reason:route.reason,knownAt:route.knownAt??null}];
  const entry={variant,status:'ready',entryTime:route.entryTime,entryPrice:route.entryPrice,stopPrice:route.stopLoss,
   stopAnchor:route.stopAnchor,confirmationCandleTime:route.confirmationCandleTime};
  const outcome=evaluateDoubleOrderBlockOutcome({direction,...entry,candles:m1,evaluatedAt,instrument});
  return [variant,{...entry,targetPrice:outcome.targetPrice,outcome}];
 }));
}

// Hold-Anker: exakter OB1-Retest, wenn er vor dem OB2-Retest bekannt ist, sonst die Reaktion ohne exakten Einstich selbst.
// Ein OB1-Bruch vor dem OB2-Retest schwemmt immer auch diesen Anker aus; der Hold-Gate deckt ihn mit ab.
export function firstRetestHoldAnchor(exactAnchor,secondRetestAt){
 return exactAnchor&&exactAnchor.fromTime<=secondRetestAt?'exact':'near';
}
// Auch vom Chart-Debugger genutzt, damit er den Hold eines gescheiterten Paars mit demselben Anker zeigt.
export function firstRetestHoldAnchorOf(context,first,secondRetestAt,bridgeClosures){
 first.exactAnchor??=exactRetestAnchor(context,first.orderBlock,first.reaction,{bridgeClosures})??false;
 const kind=firstRetestHoldAnchor(first.exactAnchor,secondRetestAt);
 return {kind,...(kind==='exact'?first.exactAnchor:{fromTime:first.reaction.fvg.recognizedAt,price:first.reaction.penetration.extremePrice})};
}
export function firstRetestHoldHistory(context,first,secondRetestAt,m1,evaluatedAt,bridgeClosures){
 const anchor=firstRetestHoldAnchorOf(context,first,secondRetestAt,bridgeClosures),key=`${anchor.kind}Hold`;
 first[key]??=orderBlockRetestHoldHistory({candles:m1,direction:first.orderBlock.dir===1?'long':'short',
  anchorPrice:anchor.price,fromTime:anchor.fromTime,evaluatedAt,instrument:bridgeClosures?context.instrument:null});
 return first[key];
}

// nearTouch 'none': über Feb–Nov kostete der Near-Touch Route a 53 R (analysis/dob/ablation-v7.json).
// bridgeClosures false: Ein OB, dessen Reaktion oder OB1-Hold bis zum ersten XAU-Marktschluss nach der Erkennung nicht
// abgeschlossen ist, verfällt (Reaktion marketClosed, Hold unknown); Entry, Outcome und FVG-Füllung überbrücken weiter.
// So gemessen: die überbrückten Paare waren in Okt/Nov 39 Zusatz-Trades mit 25,6 % Winrate.
export const DOUBLE_ORDER_BLOCK_DEFAULT_OPTIONS=Object.freeze({nearTouch:'none',bridgeClosures:false});
const NEAR_TOUCH_ROLES={none:{first:false,second:false},second:{first:false,second:true},both:{first:true,second:true}};

// Reaktionsoptionen je OB-Rolle; einzige Quelle für Detektor und Debugger.
export function reactionOptionsFor(role,options={}) {
 const {nearTouch,bridgeClosures}={...DOUBLE_ORDER_BLOCK_DEFAULT_OPTIONS,...options};
 if(!Object.hasOwn(NEAR_TOUCH_ROLES,nearTouch))throw new RangeError(`Unbekannter DOB-nearTouch-Modus: ${nearTouch}`);
 if(role!=='first'&&role!=='second')throw new RangeError(`Unbekannte DOB-Rolle: ${role}`);
 return {nearTouch:NEAR_TOUCH_ROLES[nearTouch][role],bridgeClosures:Boolean(bridgeClosures)};
}

// Sämtliche Partner werden geprüft: benachbarte/überlappende OBs dürfen sich nicht gegenseitig verdrängen.
export function detectDoubleOrderBlocks({m5Candles=[],m1Candles=[],instrument='XAUUSD',evaluatedAt,options={}}){
 const roles={first:reactionOptionsFor('first',options),second:reactionOptionsFor('second',options)};
 const {nearTouch}={...DOUBLE_ORDER_BLOCK_DEFAULT_OPTIONS,...options};
 const m5=closedChecklistCandles(m5Candles,'5m',evaluatedAt),m1=closedChecklistCandles(m1Candles,'1m',evaluatedAt);
 const result={version:DOUBLE_ORDER_BLOCK_VERSION,status:m1.length?'ready':'unknown',pairs:[],
  policy:{reaction:`first touch (within ${TOUCH_TOLERANCE_FRACTION*100} % of the OB height; near-touch via options), then first same-direction M1 FVG; M5 far edge reached within ${TOUCH_TOLERANCE_FRACTION*100} % first = false`,touchToleranceFraction:TOUCH_TOLERANCE_FRACTION,nearTouchFraction:NEAR_TOUCH_FRACTION,
   entryBMaxOrderBlockDepth:ENTRY_B_MAX_ORDER_BLOCK_DEPTH,stop:'open internal M1 FVG at entry = M5 far edge, otherwise retest extreme (contact through entry candle, no buffer)',
   firstRetestHoldThrough:'secondReactionKnownAt',retestDay:'Europe/Berlin calendar date',maxPositiveZoneGap:instrumentConfig(instrument).dobMaxPositiveZoneGap,
   options:{nearTouch,bridgeClosures:roles.first.bridgeClosures}},
  stats:{m5Bars:m5.length,m1Bars:m1.length,orderBlocks:0,reactions:{first:{true:0,false:0,unknown:0},second:{true:0,false:0,unknown:0}},pairChecks:0,
   firstHoldRejected:0,firstHoldUnknown:0,differentRetestDays:0,priceGapRejected:0,pairsWithoutEntry:0}};
 if(!Number.isFinite(evaluatedAt)||!m5.length||!m1.length)return result;
 const recognition=orderBlockRecognitionTimes(m5,'5m'),zones=detectOrderBlocks(m5,'5m',true,obMinimum(instrument,'5m'));
 const context=createOrderBlockReactionContext(m1,evaluatedAt,instrument),qualified=[],awaiting=[];
 const holdHistory=(first,secondRetestAt)=>firstRetestHoldHistory(context,first,secondRetestAt,m1,evaluatedAt,roles.first.bridgeClosures);
 // Paar-Gates in fester Reihenfolge; Detektor-Paare und Retest-Kandidaten teilen sie, nur der Hold-Zeitpunkt unterscheidet sich.
 const pairGates=(a,b,sign,holdAt)=>{
  if(!a||!b||a.orderBlock.dir!==sign||a.orderBlock.startTime>=b.orderBlock.startTime
   ||(b.orderBlock.top-a.orderBlock.top)*sign<=0||(b.orderBlock.bottom-a.orderBlock.bottom)*sign<=0
   ||a.reaction.fvg.recognizedAt>b.reaction.contact.candleTime)return {status:'geometry'};
  const priceGap=evaluateDoubleOrderBlockPriceGap(a.orderBlock,b.orderBlock,sign,instrument);
  if(priceGap.status!=='passed')return {status:'priceGap'};
  if(evaluateDoubleOrderBlockRetestDay(a.reaction.contact.candleTime,b.reaction.contact.candleTime).status!=='passed')return {status:'retestDay'};
  const firstRetestHold=orderBlockRetestHoldAt(holdHistory(a,b.reaction.contact.candleTime),holdAt);
  if(firstRetestHold.status!=='passed')return {status:firstRetestHold.status==='failed'?'holdFailed':'holdUnknown'};
  return {status:'passed',priceGap,firstRetestHold};
 };
 // Unter mehreren gültigen OB1 zählen nur die mit der spätesten OB1-Reaktion (gleichzeitige bleiben getrennte Partner).
 const latestPartners=list=>{const latest=Math.max(...list.map(p=>p.a.reaction.fvg.recognizedAt));return list.filter(p=>p.a.reaction.fvg.recognizedAt===latest);};
 result.stats.orderBlocks=zones.length;
 for(const zone of zones){
  const orderBlock={...zone,recognizedAt:recognition.get(zone.startTime),timeframe:'5M'};
  // Gleiche Optionen beider Rollen teilen sich eine Auswertung.
  const firstReaction=reactionOrSkip(context,orderBlock,roles.first);
  const secondReaction=roles.second.nearTouch===roles.first.nearTouch?firstReaction:reactionOrSkip(context,orderBlock,roles.second);
  if(!firstReaction||!secondReaction)continue;
  result.stats.reactions.first[firstReaction.state]++;result.stats.reactions.second[secondReaction.state]++;
  // OB1 braucht die Strukturreaktion, keinen eigenen Entry; OB2 behält während offener Route seinen Kandidaten.
  const asFirst=firstReaction.structuralState==='true'?{orderBlock,reaction:firstReaction}:null;
  const asSecond=secondReaction.structuralState==='true'?{orderBlock,reaction:secondReaction}:null;
  // Opt-in für den Alarm vor dem Entry (DOB-Setup v1, Phase ob2Retest): OB2 ist berührt, die Reaktions-FVG steht noch aus.
  if(options.retests&&!asSecond&&secondReaction.reason==='awaitingFvg')awaiting.push({orderBlock,reaction:secondReaction});
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
  const gate=pairGates(a,b,sign,b?.reaction.fvg.recognizedAt);
  if(gate.status!=='passed'){
   const stat={priceGap:'priceGapRejected',retestDay:'differentRetestDays',holdFailed:'firstHoldRejected',holdUnknown:'firstHoldUnknown'}[gate.status];
   if(stat)result.stats[stat]++;
   continue;
  }
  const {priceGap,firstRetestHold}=gate;
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
  if(partners.length&&!Object.values(qualified[second].asSecond.entries).some(e=>e.status==='ready'||e.status==='pending'))
   result.stats.pairsWithoutEntry+=partners.length;
  else result.pairs.push(...partners);
 }
 // Retest-Kandidat: dieselben Gates, der OB1-Hold muss bis jetzt halten (die Reaktion, an der ihn das Paar prüft, fehlt noch).
 if(options.retests)result.retests=awaiting.flatMap(b=>{
  const sign=b.orderBlock.dir,passed=[];
  for(const q of qualified){const gate=pairGates(q.asFirst,b,sign,evaluatedAt);if(gate.status==='passed')passed.push({a:q.asFirst,gate});}
  return passed.length?latestPartners(passed).map(({a,gate})=>({id:`dob:${instrument}:${sign}:${a.orderBlock.startTime}:${b.orderBlock.startTime}`,
   instrument,direction:sign===1?'long':'short',firstOrderBlock:a.orderBlock,secondOrderBlock:b.orderBlock,
   firstRetest:{candleTime:a.reaction.contact.candleTime,recognizedAt:a.reaction.contact.knownAt,contact:a.reaction.contact.status},
   secondRetest:{candleTime:b.reaction.contact.candleTime,recognizedAt:b.reaction.contact.knownAt,contact:b.reaction.contact.status},
   firstReaction:a.reaction.fvg,firstRetestHold:gate.firstRetestHold,priceGap:gate.priceGap,recognizedAt:b.reaction.contact.knownAt})):[];
 });
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
