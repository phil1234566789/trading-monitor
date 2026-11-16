import {detectOrderBlocks,candleInvalidatesOrderBlock,candleTouchesOrderBlock} from './orderBlockDetection.js';
import {orderBlockRecognitionTimes} from './orderBlockRecognitionTime.js';
import {obMinimum,instrumentConfig} from './instrumentConfig.js';

// Quelle der Kraft v1 (Philip, Q15/Q16): aktive H1/H4-OB-Zone in Trade-Richtung, höchstens k H1-ATR(14) von OB1 entfernt.
// k je Instrument in instrumentConfig (dobSourceMaxAtr); nur XAU ist gemessen (analysis/dob-setup/source-g-xau-2026.json),
// ohne Eintrag gibt es bewusst keine Quelle statt eines stillen Defaults. Messskript und Produkt teilen dieses Modul.
export const sourceMaxDistanceAtr=instrument=>instrumentConfig(instrument).dobSourceMaxAtr??null;
const HOUR=3600,ATR_PERIOD=14;
const TIMEFRAMES=[['1h','H1','1H'],['4h','H4','4H']];

const lowerBound=(rows,t)=>{let lo=0,hi=rows.length;while(lo<hi){const m=(lo+hi)>>1;if(rows[m].time<t)lo=m+1;else hi=m;}return lo;};

// htfCandles: {'1h','4h'} wie markHtfObCandles (Session-Ignore + Session-Extreme), beliebig lange Historie.
// Zonen sind beliebig alt; ihr Bruch wird einmal auf H1 vorberechnet, damit Live keine Monate M5 laden muss.
// Die Invalidierung ist dochtbasiert, eine H1-Kerze bricht also genau dann, wenn eine ihrer M5-Kerzen bricht.
// m5Candles (optional, session-markiert): Touch-Episoden ab dem ersten M5 genau, davor auf H1 (retestKind/retestAgeSeconds).
export function dobSourceContext({htfCandles,m5Candles=[],instrument='XAUUSD'}){
 const h1=(htfCandles?.['1h']??[]).filter(c=>!c.ignored),m5=m5Candles.filter(c=>!c.ignored),zones=[];
 for(const [bar,tf,label] of TIMEFRAMES){
  const rows=htfCandles?.[bar]??[];
  const recognized=orderBlockRecognitionTimes(rows,bar);
  for(const zone of detectOrderBlocks(rows,label,false,obMinimum(instrument,label))){
   const recognizedAt=recognized.get(zone.startTime);
   if(!recognizedAt)continue;
   let brokenH1=Infinity,touchedH1=Infinity;
   for(let i=lowerBound(h1,recognizedAt);i<h1.length;i++){
    if(touchedH1===Infinity&&candleTouchesOrderBlock(h1[i],zone))touchedH1=h1[i].time;
    if(candleInvalidatesOrderBlock(h1[i],zone)){brokenH1=h1[i].time;break;}
   }
   zones.push({tf,dir:zone.dir,side:zone.dir===1?'long':'short',top:zone.top,bottom:zone.bottom,startTime:zone.startTime,recognizedAt,brokenH1,touchedH1,
    touches:touchEpisodes(zone,recognizedAt,h1,m5)});
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

// Touch-Episode = aufeinanderfolgende berührende Kerzen (Docht reicht), gespeichert als Startzeit; bis zum Bruch der Zone.
// Vor dem ersten verfügbaren M5 zählen volle H1-Stunden, danach M5 (eine über die Grenze laufende Episode bleibt eine).
function touchEpisodes(zone,recognizedAt,h1,m5){
 const m5Start=m5[0]?.time??Infinity,starts=[];
 let touching=false;
 const step=(c,time)=>{
  const touch=candleTouchesOrderBlock(c,zone);
  if(touch&&!touching)starts.push(time);
  touching=touch;
  return candleInvalidatesOrderBlock(c,zone);
 };
 for(let i=lowerBound(h1,recognizedAt);i<h1.length&&h1[i].time+HOUR<=m5Start;i++)if(step(h1[i],h1[i].time))return starts;
 for(let i=lowerBound(m5,Math.max(recognizedAt,m5Start));i<m5.length;i++)if(step(m5[i],m5[i].time))return starts;
 return starts;
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

// Retest (Philip, Q17): der Preis hat die Zone nach ihrer Erkennung und vor dem OB1-Start mindestens einmal berührt (Docht reicht).
// Gleiche Aufteilung wie der Bruch: volle Stunden auf H1, die angebrochene Stunde auf M5 bis vor den OB1-Start.
function zoneRetestedBefore(zone,at,m5Candles){
 const hourStart=Math.floor(at/HOUR)*HOUR;
 if(zone.touchedH1<hourStart)return true;
 for(let i=lowerBound(m5Candles,Math.max(zone.recognizedAt,hourStart));i<m5Candles.length&&m5Candles[i].time<at;i++)
  if(!m5Candles[i].ignored&&candleTouchesOrderBlock(m5Candles[i],zone))return true;
 return false;
}

// Alle aktiven Zonen in Trade-Richtung zum OB1-Start. Abstand = kürzester Preisabstand der einander zugewandten Kanten
// (Short: Zone unten − OB1 oben), 0 bei Überlappung. wrongSide: OB1 ragt über die Seite hinaus, von der der Preis abprallen soll.
export function htfSourceCandidates(context,{firstOrderBlock:ob1,direction,m5Candles,timeframes=['H1','H4']}){
 const at=ob1.startTime,atr=h1AtrAt(context,at),result=[];
 for(const zone of context.zones){
  if(zone.side!==direction||!timeframes.includes(zone.tf)||!zoneActiveAt(zone,at,m5Candles))continue;
  const distanceUsd=Math.max(0,zone.bottom-ob1.top,ob1.bottom-zone.top);
  result.push({kind:'htfOb',timeframe:zone.tf,zone:{top:zone.top,bottom:zone.bottom},zoneStartTime:zone.startTime,zoneRecognizedAt:zone.recognizedAt,
   distanceUsd,atr,distanceAtr:atr?distanceUsd/atr:null,retested:zoneRetestedBefore(zone,at,m5Candles),...retestInfo(zone,at),
   wrongSide:direction==='short'?ob1.top>zone.top:ob1.bottom<zone.bottom,contextZone:zone});
 }
 return result;
}

// Für spätere Guardrails (Folge-Touch, frischer Retest): Art und Alter des letzten Touchs vor OB1, Alter ab Episodenstart.
function retestInfo(zone,at){
 const before=zone.touches.slice(0,lowerBoundValue(zone.touches,at));
 return before.length?{retestKind:before.length===1?'first':'followUp',retestCount:before.length,retestAgeSeconds:at-before.at(-1)}
  :{retestKind:null,retestCount:0,retestAgeSeconds:null};
}
const lowerBoundValue=(values,t)=>{let lo=0,hi=values.length;while(lo<hi){const m=(lo+hi)>>1;if(values[m]<t)lo=m+1;else hi=m;}return lo;};

// Nächste aktive Zone; mit requireRetest nur unter den retesteten (v2).
export function nearestHtfSource(context,args,{requireRetest=false}={}){
 const best=htfSourceCandidates(context,args).filter(c=>!requireRetest||c.retested)
  .reduce((a,c)=>!a||c.distanceUsd<a.distanceUsd?c:a,null);
 if(!best)return null;
 const {contextZone,...source}=best;
 return source;
}

export const sourceOfStrengthPassed=(source,maxAtr)=>maxAtr!=null&&source?.distanceAtr!=null&&source.distanceAtr<=maxAtr;
