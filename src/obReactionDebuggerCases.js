import {detectOrderBlocks} from './orderBlockDetection.js';
import {orderBlockRecognitionTimes} from './orderBlockRecognitionTime.js';
import {closedChecklistCandles} from './tradeSetupChecklistTimeBasis.js';
import {obMinimum} from './instrumentConfig.js';
import {createOrderBlockReactionContext,evaluateOrderBlockReaction,INTERNAL_FVG_LOOKBACK_SECONDS} from './orderBlockReaction.js';
import {detectDoubleOrderBlocks,DOUBLE_ORDER_BLOCK_DEFAULT_OPTIONS} from './doubleOrderBlocks.js';

const INSTRUMENT='XAUUSD';
// Statische Imports wären ~1 MB im Bundle; jeder Fixture-Tag wird erst bei Auswahl nachgeladen.
const FIXTURES={
 '2026-10-16':()=>import('../test/fixtures/dob-native/2026-10-16.json'),
 '2026-10-21':()=>import('../test/fixtures/dob-native/2026-10-21.json'),
 '2026-11-09':()=>import('../test/fixtures/dob-native/2026-11-09.json'),
 '2026-10-20-p17':()=>import('../test/fixtures/dob-native/2026-10-20-p17.json'),
};
export const loadCaseFixture=async c=>(await FIXTURES[c.day]()).default;

// OB-Startzeiten aus references.json (P14/P16), 2026-10-20-p17.json (P17) und test/orderBlockReaction.test.js (Pins).
export const OB_REACTION_CASES=[
 {id:'P14',label:'P14 · DOB Short · 16.10.',day:'2026-10-16',dir:-1,orderBlocks:[1792147500,1792150200]},
 {id:'P16',label:'P16 · DOB Long · 21.10.',day:'2026-10-21',dir:1,orderBlocks:[1792545900,1792552500]},
 {id:'500',label:'Pin 500 · Short · 16.10.',day:'2026-10-16',dir:-1,orderBlocks:[1792150200]},
 {id:'501',label:'Pin 501 · Short · 09.11.',day:'2026-11-09',dir:-1,orderBlocks:[1794192300]},
 {id:'502',label:'Pin 502 · Long · 21.10.',day:'2026-10-21',dir:1,orderBlocks:[1792552500]},
 {id:'503',label:'Pin 503 · Long · 21.10.',day:'2026-10-21',dir:1,orderBlocks:[1792555800]},
 {id:'504',label:'Pin 504 · Long · 21.10.',day:'2026-10-21',dir:1,orderBlocks:[1792558800]},
 {id:'P17',label:'P17 · DOB Short · 20.10.',day:'2026-10-20-p17',dir:-1,orderBlocks:[1792473900,1792479900]},
];

// Replay-Fenster: ab Bildung von OB1 vier Stunden, damit Reaktion und beide Entry-Routen sicher drinliegen.
export const CASE_WINDOW_SECONDS=4*3600;
export function caseSteps(c,fixture){
 const last=fixture.candles.m1.at(-1).time+60,from=c.orderBlocks[0]+300;
 return {from,through:Math.min(last,from+CASE_WINDOW_SECONDS)};
}

// Ein Einzel-OB wird wie OB2 bewertet: nur dort trägt die Reaktion Entry-Routen (Pins 500/502 = OB2 von P14/P16).
function nearTouchFor(role){
 const mode=DOUBLE_ORDER_BLOCK_DEFAULT_OPTIONS.nearTouch;
 return mode==='both'||mode==='second'&&role==='second';
}

// Alles nur aus Kerzen, die zu evaluatedAt geschlossen sind; dieselben Produktmodule wie Chart und Messung.
export function evaluateCase(c,fixture,evaluatedAt){
 const m5=closedChecklistCandles(fixture.candles.m5,'5m',evaluatedAt),m1=closedChecklistCandles(fixture.candles.m1,'1m',evaluatedAt);
 const recognition=orderBlockRecognitionTimes(m5,'5m'),zones=detectOrderBlocks(m5,'5m',true,obMinimum(INSTRUMENT,'5m'));
 const context=createOrderBlockReactionContext(m1,evaluatedAt,INSTRUMENT);
 const orderBlocks=c.orderBlocks.map((startTime,index)=>{
  const role=c.orderBlocks.length===1||index===1?'second':'first',zone=zones.find(z=>z.startTime===startTime&&z.dir===c.dir);
  const recognizedAt=recognition.get(startTime);
  if(!zone||!(recognizedAt<=evaluatedAt))return {role,startTime,orderBlock:null,reaction:null,internalFvgs:[]};
  const orderBlock={...zone,recognizedAt,timeframe:'5M'};
  const internalFvgs=context.byDirection[c.dir===1?'long':'short'].filter(f=>f.candleTime>=startTime-INTERNAL_FVG_LOOKBACK_SECONDS
   &&f.bottom<=orderBlock.top&&f.top>=orderBlock.bottom);
  return {role,startTime,orderBlock,internalFvgs,reaction:evaluateOrderBlockReaction(context,orderBlock,{nearTouch:nearTouchFor(role)})};
 });
 let pair=null;
 if(c.orderBlocks.length===2){
  const id=`dob:${INSTRUMENT}:${c.dir}:${c.orderBlocks[0]}:${c.orderBlocks[1]}`;
  pair=detectDoubleOrderBlocks({m5Candles:fixture.candles.m5,m1Candles:fixture.candles.m1,instrument:INSTRUMENT,evaluatedAt}).pairs.find(p=>p.id===id)??null;
 }
 return {m1,orderBlocks,pair};
}
