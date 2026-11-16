import {detectOrderBlocks} from './orderBlockDetection.js';
import {orderBlockRecognitionTimes} from './orderBlockRecognitionTime.js';
import {doubleOrderBlockInput} from './doubleOrderBlockInput.js';
import {obMinimum} from './instrumentConfig.js';
import {createOrderBlockReactionContext,evaluateOrderBlockReaction,internalOrderBlockFvgs} from './orderBlockReaction.js';
import {detectDoubleOrderBlocks,reactionOptionsFor} from './doubleOrderBlocks.js';
import references from '../test/fixtures/dob-native/references.json';
import EXPECTATIONS from '../test/fixtures/dob-native/chart-debugger-expectations.json';

const INSTRUMENT='XAUUSD';
// Statische Imports wären ~1 MB im Bundle; jeder Fixture-Tag wird erst bei Auswahl nachgeladen.
const FIXTURES={
 '2026-10-16':()=>import('../test/fixtures/dob-native/2026-10-16.json'),
 '2026-10-21':()=>import('../test/fixtures/dob-native/2026-10-21.json'),
 '2026-10-22':()=>import('../test/fixtures/dob-native/2026-10-22.json'),
 '2026-11-03':()=>import('../test/fixtures/dob-native/2026-11-03.json'),
 '2026-11-04':()=>import('../test/fixtures/dob-native/2026-11-04.json'),
 '2026-11-09':()=>import('../test/fixtures/dob-native/2026-11-09.json'),
 '2026-10-20-p17':()=>import('../test/fixtures/dob-native/2026-10-20-p17.json'),
};
export const loadCaseFixture=async c=>(await FIXTURES[c.day]()).default;

// OB-Startzeiten aus references.json (P14/P16), 2026-10-20-p17.json (P17) und test/orderBlockReaction.test.js (Pins); 507/508 aus get_pin_context.
export const CHART_DEBUGGER_CASES=[
 {id:'P14',label:'P14 · DOB Short · 16.10.',day:'2026-10-16',dir:-1,orderBlocks:[1792147500,1792150200]},
 {id:'P16',label:'P16 · DOB Long · 21.10.',day:'2026-10-21',dir:1,orderBlocks:[1792545900,1792552500]},
 {id:'P7',label:'P7 · DOB Short · 03.11. · Pins 451/452',day:'2026-11-03',dir:-1,orderBlocks:[1793669400,1793671200]},
 {id:'500',label:'Pin 500 · Short · 16.10.',day:'2026-10-16',dir:-1,orderBlocks:[1792150200]},
 {id:'501',label:'Pin 501 · Short · 09.11.',day:'2026-11-09',dir:-1,orderBlocks:[1794192300]},
 {id:'502',label:'Pin 502 · Long · 21.10.',day:'2026-10-21',dir:1,orderBlocks:[1792552500]},
 {id:'503',label:'Pin 503 · Long · 21.10.',day:'2026-10-21',dir:1,orderBlocks:[1792555800]},
 {id:'504',label:'Pin 504 · Long · 21.10.',day:'2026-10-21',dir:1,orderBlocks:[1792558800]},
 {id:'P11',label:'P11 · DOB Short · 22.10.',day:'2026-10-22',dir:-1,orderBlocks:[1792684800,1792686600]},
 // P13: OB2 kommt erst 5:40 h nach OB1, die Reaktion um 12:20; das Standardfenster von 4 h endet davor.
 {id:'P13',label:'P13 · DOB Long · 21.10.',day:'2026-10-21',dir:1,orderBlocks:[1792545600,1792566000],windowSeconds:10*3600},
 {id:'P17',label:'P17 · DOB Short · 20.10.',day:'2026-10-20-p17',dir:-1,orderBlocks:[1792473900,1792479900]},
 {id:'507',label:'Pin 507 · DOB Short · 09.11.',day:'2026-11-09',dir:-1,orderBlocks:[1794204000,1794205800]},
 {id:'508',label:'Pin 508 · DOB Short · 09.11.',day:'2026-11-09',dir:-1,orderBlocks:[1794205800,1794207000]},
 {id:'U1',label:'U1 · Short · 03.11. · Gegen-FVG offen, OB bricht vor Entry b',day:'2026-11-03',dir:-1,orderBlocks:[1793694900]},
 {id:'U2',label:'U2 · Short · 09.11. · FVG ragt unten raus, SL M5-Kante',day:'2026-11-09',dir:-1,orderBlocks:[1794234600]},
 {id:'U3',label:'U3 · Offen · Short · 04.11. · Entry b nach Marktschluss',day:'2026-11-04',dir:-1,orderBlocks:[1793824800]},
 {id:'U4',label:'U4 · Short · 16.10. · Gegen-FVG 10:20 vor der Nase, OB bricht',day:'2026-10-16',dir:-1,orderBlocks:[1792137600]},
];
// Fachliches Soll (Philip), nicht das Produkt: Referenzpaare aus dem Manifest, übrige Fälle aus der kleinen Tabelle.
const REFERENCE_PAIRS=new Set(references.pairs.map(p=>p.id));
export const expectationOf=c=>EXPECTATIONS.cases[c.id]??(REFERENCE_PAIRS.has(c.id)?{verdict:'positive',dob:true,source:'references.json'}:null);
export function expectedText(c){
 const e=expectationOf(c);
 if(!e)return 'kein Soll';
 if(e.verdict==='offen')return `Offen · ${e.note}`;
 const routes=Object.entries(e.routes??{}),rejected=routes.filter(([,x])=>x==='rejected').map(([k])=>k);
 const detail=e.dob?'DOB':e.reaction==='false'?'Reaktion false, kein Entry':rejected.length?`Entry ${rejected.join('+')} abgelehnt`:`Reaktion ${e.reaction}`;
 return `${e.verdict==='positive'?'Positiv':'Negativ'} · ${detail}`;
}
// Vergleicht nur, was das Soll festlegt: DOB erkannt, Reaktionsstatus des entry-tragenden OB, einzelne Routenstatus.
export function productMatches(c,result){
 const e=expectationOf(c),r=result.orderBlocks.at(-1).reaction;
 if(!e)return null;
 // Offen = Philip klärt noch; ✓ heißt nur: das Produkt liefert hier weiter denselben Zustand (bei unknown: denselben Grund).
 if(e.verdict==='offen')return r?.verdict?.state===e.state&&(e.state!=='unknown'||r.verdict.reason===e.reason);
 if(e.dob&&!result.pair)return false;
 if(e.reaction&&r?.state!==e.reaction)return false;
 if(e.verdict==='negative'&&Object.values(r?.routes??{}).some(route=>route.status==='entry'))return false;
 return Object.entries(e.routes??{}).every(([k,x])=>r?.routes?.[k]?.status===x);
}
export const CASE_GROUPS=[['Positiv',CHART_DEBUGGER_CASES.filter(c=>expectationOf(c)?.verdict==='positive')],
 ['Negativ',CHART_DEBUGGER_CASES.filter(c=>expectationOf(c)?.verdict==='negative')],
 ['Offen',CHART_DEBUGGER_CASES.filter(c=>expectationOf(c)?.verdict==='offen')]];

// Replay-Fenster: ab Bildung von OB1 vier Stunden, damit Reaktion und beide Entry-Routen sicher drinliegen.
export const CASE_WINDOW_SECONDS=4*3600;
export function caseSteps(c,fixture){
 const last=fixture.candles.m1.at(-1).time+60,from=c.orderBlocks[0]+300;
 return {from,through:Math.min(last,from+(c.windowSeconds??CASE_WINDOW_SECONDS))};
}


// Dieselbe Eingabe wie der Dashboard-Worker (geschlossen + Session-Ignore), dieselben Produktmodule wie Chart und Messung.
export function evaluateCase(c,fixture,evaluatedAt,options={}){
 const input=doubleOrderBlockInput({m5:fixture.candles.m5,m1:fixture.candles.m1,symbol:INSTRUMENT,evaluatedAt}),m5=input.m5Candles,m1=input.m1Candles;
 const recognition=orderBlockRecognitionTimes(m5,'5m'),zones=detectOrderBlocks(m5,'5m',true,obMinimum(INSTRUMENT,'5m'));
 const context=createOrderBlockReactionContext(m1,evaluatedAt,INSTRUMENT);
 const orderBlocks=c.orderBlocks.map((startTime,index)=>{
  // Ein Einzel-OB wird wie OB2 bewertet: nur dort trägt die Reaktion Entry-Routen (Pins 500/502 = OB2 von P14/P16).
  const role=c.orderBlocks.length===1||index===1?'second':'first',zone=zones.find(z=>z.startTime===startTime&&z.dir===c.dir);
  const recognizedAt=recognition.get(startTime);
  if(!zone||!(recognizedAt<=evaluatedAt))return {role,startTime,orderBlock:null,reaction:null,internalFvgs:[]};
  const orderBlock={...zone,recognizedAt,timeframe:'5M'};
  const internalFvgs=internalOrderBlockFvgs(context,orderBlock);
  return {role,startTime,orderBlock,internalFvgs,reaction:evaluateOrderBlockReaction(context,orderBlock,reactionOptionsFor(role,options))};
 });
 let pair=null;
 if(c.orderBlocks.length===2){
  const id=`dob:${INSTRUMENT}:${c.dir}:${c.orderBlocks[0]}:${c.orderBlocks[1]}`;
  pair=detectDoubleOrderBlocks({...input,options}).pairs.find(p=>p.id===id)??null;
 }
 return {m1,m5,context,orderBlocks,pair};
}
