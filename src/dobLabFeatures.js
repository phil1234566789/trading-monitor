import {pivotTimeOf} from './marketStructureAnalysis';
import {structureInWindow,dobTrendVerdict} from './dobM5Trend.js';

// Merkmal-Labor gegen DOB-Losses (Brain-Task Merkmal-Labor, Q24): je Trade zum Entscheidungszeitpunkt, nur geschlossene Kerzen.
// Reine Messfunktionen, noch keine Regel; Trend-Algo und DOB-Indikator bleiben unangetastet.
const tradeTrend=direction=>direction==='long'?'uptrend':'downtrend';

// 1. Äußerer Trend: oberste Ebene der Struktur (nicht die innerste wie v3, die misst die Rückholbewegung in die Zone).
// durationDays = seit dem Ursprung der äußeren Range (appliedPivots[0]).
export function dobOuterTrend(candles,at,direction,{windowDays,barSeconds}){
 const state=structureInWindow(candles,at,windowDays*86400,{barSeconds})?.state;
 const trend=state?.trend??'unknown',origin=state?.appliedPivots?.[0];
 return {trend,verdict:dobTrendVerdict(direction,trend),
  durationDays:trend!=='unknown'&&origin?+((at-pivotTimeOf(origin))/86400).toFixed(2):null};
}

// 2. M5-Struktur bestätigt die Trade-Richtung: Phasenwechsel (CHoCH/BOS/Trendwechsel/Fortsetzung) in Trade-Richtung,
// verarbeitet zwischen fromTime und Entry. Ein Trend, der schon vorher lief, zählt nicht als frische Bestätigung.
export function dobM5Confirmation(m5Candles,entryTime,direction,fromTime,{windowDays=2}={}){
 const built=structureInWindow(m5Candles,entryTime,windowDays*86400);
 const events=(built?.events??[]).filter(e=>e.trend===tradeTrend(direction)&&e.at>fromTime&&e.at<=entryTime).map(e=>({reason:e.reason,at:e.at}));
 return {confirmed:events.length>0,events,innerTrendAtEntry:built?built.phases.at(-1)?.trend??'unknown':'unknown'};
}

// 3. Gegen-DOBs: Paare in Gegenrichtung, erkannt zwischen fromTime und Entry (dob = detectDoubleOrderBlocks am Entry).
export function dobCounterDobs(dob,direction,fromTime,entryTime){
 const opposite=(dob?.pairs??[]).filter(p=>p.direction!==direction&&p.recognizedAt>fromTime&&p.recognizedAt<=entryTime);
 return {count:new Set(opposite.map(p=>p.secondOrderBlock.startTime)).size};
}

// 4. OB1 und OB2 in der Kraft-Zone: Preisabstand 0 (Überlappung), wie distanceUsd der Quelle.
const gap=(ob,zone)=>Math.max(0,zone.bottom-ob.top,ob.bottom-zone.top);
export function dobObsInSourceZone(chart,source){
 if(!source?.zone)return null;
 const ob1=gap(chart.firstOrderBlock,source.zone)===0,ob2=gap(chart.secondOrderBlock,source.zone)===0;
 return {ob1,ob2,both:ob1&&ob2};
}
