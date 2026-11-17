import {computeRangesPivots,deriveTrendReaction} from './marketStructureAnalysis';
import {buildStructureWithPhases} from './trendPhases.js';
import {fmtDateTime} from './format.js';

// DOB-Setup v3 (Experiment, Philip): kein DOB-Trade gegen den innersten M5-Strukturtrend. Aufruf des Trend-Algos wie der
// Chart (usePriceChartMarketStructure → chartStructureCalculation): Perioden 5/2, ignorierte Kerzen raus, Close-Auswertung.
// Statt des Ankers am innersten 1h-Start zählen die letzten 24 h (Philip); ist der Trend dort unknown, wächst das Fenster
// tageweise bis höchstens 7 Tage (Q21, Pin 519). Der Algo selbst bleibt unverändert, nur der Fensterstart wandert.
export const DOB_M5_TREND_WINDOW_SECONDS=24*3600;
export const DOB_M5_TREND_MAX_DAYS=7;
export const DOB_M5_TREND_PERIODS=Object.freeze({outer:5,inner:2});
// Vorlauf vor dem Fenster, damit ein Fraktal am Fensteranfang seine Vorgängerkerzen hat (Kaskade period+4).
const LEAD_SECONDS=2*3600;
const M5=300;

const lowerBound=(rows,t)=>{let lo=0,hi=rows.length;while(lo<hi){const m=(lo+hi)>>1;if(rows[m].time<t)lo=m+1;else hi=m;}return lo;};

// Innerster M5-Trend zum Zeitpunkt at, nur aus Kerzen, die bis at geschlossen sind (kausal). m5Candles session-markiert.
// maxDays 1 = nur 24 h; windowDays im Ergebnis = Fensterstufe, in der der Trend gefunden wurde.
export function dobM5Trend(m5Candles,at,{maxDays=DOB_M5_TREND_MAX_DAYS,periods=DOB_M5_TREND_PERIODS}={}){
 let result={trend:'unknown',reaction:null};
 for(let days=1;days<=maxDays;days++){
  result=trendInWindow(m5Candles,at,days*DOB_M5_TREND_WINDOW_SECONDS,periods);
  if(result.trend!=='unknown')return {...result,windowDays:days};
 }
 return {...result,windowDays:maxDays};
}

function trendInWindow(m5Candles,at,windowSeconds,periods){
 const anchor=at-windowSeconds,candles=[];
 for(let i=lowerBound(m5Candles,anchor-LEAD_SECONDS);i<m5Candles.length&&m5Candles[i].time+M5<=at;i++)if(!m5Candles[i].ignored)candles.push(m5Candles[i]);
 if(!candles.length)return {trend:'unknown',reaction:null};
 const outer=computeRangesPivots(candles,periods.outer,anchor,fmtDateTime),inner=computeRangesPivots(candles,periods.inner,anchor,fmtDateTime);
 const {state}=buildStructureWithPhases(outer,inner,periods.outer,periods.inner,candles,M5,{closeEvaluation:true});
 return deriveTrendReaction(state);
}

// Anti-Gate: Short gegen einen Aufwärtstrend und Long gegen einen Abwärtstrend sind „gegen den Trend“.
export function dobTrendVerdict(direction,trend){
 if(trend==='uptrend')return direction==='short'?'against':'with';
 if(trend==='downtrend')return direction==='long'?'against':'with';
 return 'unknown';
}

// Gate für checkDobTradeSetup (input.trendGate): Trend zur OB2-Retest-Zeit (Kontakt bekannt), je M5-Schluss gecacht.
export function createDobM5TrendGate(m5Candles,{blockUnknown=false,...options}={}){
 const cache=new Map();
 const trendAt=at=>{const key=Math.floor(at/M5)*M5;if(!cache.has(key))cache.set(key,dobM5Trend(m5Candles,key,options));return cache.get(key);};
 return setup=>{
  const at=setup.chart.secondRetestTime+60,{trend,windowDays}=trendAt(at),verdict=dobTrendVerdict(setup.direction,trend);
  return {trend,windowDays,verdict,at,rejectReason:verdict==='against'?'againstM5Trend':verdict==='unknown'&&blockUnknown?'m5TrendUnknown':null};
 };
}
