import {detectOrderBlocks,candleInvalidatesOrderBlock} from './orderBlockDetection.js';
import {orderBlockRecognitionTimes} from './orderBlockRecognitionTime.js';
import {obMinimum} from './instrumentConfig.js';

// Quelle der Kraft v1 (Philip, Q15/Q16): aktive H1/H4-OB-Zone in Trade-Richtung, höchstens 1,5 H1-ATR(14) von OB1 entfernt.
// Gemessen in analysis/dob-setup/source-g-xau-2026.json; Messskript (scripts/dobSourceMeasurement.mjs) und Produkt teilen dieses Modul.
export const SOURCE_MAX_DISTANCE_ATR=1.5;
const HOUR=3600,ATR_PERIOD=14;
const TIMEFRAMES=[['1h','H1','1H'],['4h','H4','4H']];

const lowerBound=(rows,t)=>{let lo=0,hi=rows.length;while(lo<hi){const m=(lo+hi)>>1;if(rows[m].time<t)lo=m+1;else hi=m;}return lo;};

// htfCandles: {'1h','4h'} wie markHtfObCandles (Session-Ignore + Session-Extreme), beliebig lange Historie.
// Zonen sind beliebig alt; ihr Bruch wird einmal auf H1 vorberechnet, damit Live keine Monate M5 laden muss.
// Die Invalidierung ist dochtbasiert, eine H1-Kerze bricht also genau dann, wenn eine ihrer M5-Kerzen bricht.
export function dobSourceContext({htfCandles,instrument='XAUUSD'}){
 const h1=(htfCandles?.['1h']??[]).filter(c=>!c.ignored),zones=[];
 for(const [bar,tf,label] of TIMEFRAMES){
  const rows=htfCandles?.[bar]??[];
  const recognized=orderBlockRecognitionTimes(rows,bar);
  for(const zone of detectOrderBlocks(rows,label,false,obMinimum(instrument,label))){
   const recognizedAt=recognized.get(zone.startTime);
   if(!recognizedAt)continue;
   let brokenH1=Infinity;
   for(let i=lowerBound(h1,recognizedAt);i<h1.length;i++)if(candleInvalidatesOrderBlock(h1[i],zone)){brokenH1=h1[i].time;break;}
   zones.push({tf,dir:zone.dir,side:zone.dir===1?'long':'short',top:zone.top,bottom:zone.bottom,startTime:zone.startTime,recognizedAt,brokenH1});
  }
 }
 // ATR(14) nach Wilder über die gehandelten H1-Kerzen; im Repo gab es keine ATR-Funktion.
 const atr=[];
 for(let i=1,value=null,sum=0;i<h1.length;i++){
  const c=h1[i],prev=h1[i-1].close,tr=Math.max(c.high-c.low,Math.abs(c.high-prev),Math.abs(c.low-prev));
  if(i<=ATR_PERIOD){sum+=tr;if(i===ATR_PERIOD)value=sum/ATR_PERIOD;}else value=(value*(ATR_PERIOD-1)+tr)/ATR_PERIOD;
  if(value!=null)atr.push({time:c.time+HOUR,value});
 }
 return {zones,atr};
}

// Letzter abgeschlossener H1-ATR vor at.
export function h1AtrAt(context,at){
 const i=lowerBound(context.atr,at+1);
 return context.atr[i-1]?.value??null;
}

// Aktiv zum Zeitpunkt at: erkannt und bis at nicht gebrochen. Volle H1-Stunden vor at aus dem Vorlauf, die angebrochene Stunde
// auf den (session-markierten) M5-Kerzen bis einschließlich at, wie in der Messung.
function zoneActiveAt(zone,at,m5Candles){
 const hourStart=Math.floor(at/HOUR)*HOUR;
 if(zone.recognizedAt>at||zone.brokenH1<hourStart)return false;
 for(let i=lowerBound(m5Candles,Math.max(zone.recognizedAt,hourStart));i<m5Candles.length&&m5Candles[i].time<=at;i++)
  if(!m5Candles[i].ignored&&candleInvalidatesOrderBlock(m5Candles[i],zone))return false;
 return true;
}

// Nächste aktive Zone in Trade-Richtung zum OB1-Start; Abstand = kürzester Preisabstand der Kanten, 0 bei Überlappung.
export function nearestHtfSource(context,{firstOrderBlock:ob1,direction,m5Candles,timeframes=['H1','H4']}){
 const at=ob1.startTime;
 let best=null;
 for(const zone of context.zones){
  if(zone.side!==direction||!timeframes.includes(zone.tf)||!zoneActiveAt(zone,at,m5Candles))continue;
  const distanceUsd=Math.max(0,zone.bottom-ob1.top,ob1.bottom-zone.top);
  if(!best||distanceUsd<best.distanceUsd)best={zone,distanceUsd};
 }
 if(!best)return null;
 const atr=h1AtrAt(context,at),{zone}=best;
 return {kind:'htfOb',timeframe:zone.tf,zone:{top:zone.top,bottom:zone.bottom},zoneStartTime:zone.startTime,zoneRecognizedAt:zone.recognizedAt,
  distanceUsd:best.distanceUsd,atr,distanceAtr:atr?best.distanceUsd/atr:null};
}

export const sourceOfStrengthPassed=source=>source?.distanceAtr!=null&&source.distanceAtr<=SOURCE_MAX_DISTANCE_ATR;
