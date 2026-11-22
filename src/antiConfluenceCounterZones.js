import {detectOrderBlocks} from './orderBlockDetection.js';
import {aggregateCandles,candlesInWindow} from './atr.js';
import {instrumentConfig,obMinimum,FOREX_MIN_FVG_PIPS} from './instrumentConfig.js';

// FVG/OB-Anti-Confluence „breit“ (analysis/lq2-sweeps, „SL statt Sperre“): eine Gegen-Zone (bullisch gegen Short, bärisch gegen Long)
// auf M5/M15/H1 aus den letzten 2 Tagen, beim Entry offen (FVG nicht vollständig durchlaufen) bzw. ungetestet (OB), zwischen Ziel und
// Entry, Kante höchstens 0,5 H1-ATR hinter dem Entry. Bekannt, getestet und durchlaufen zählen ab Schluss der jeweiligen Kerze.
export const COUNTER_ZONE_LOOKBACK_SECONDS=2*86400;
export const COUNTER_ZONE_NEAR_ATR=0.5;
const TIMEFRAMES=[['5m',300],['15M',900],['1H',3600]];
// Vorlauf vor dem 2-Tage-Fenster, damit die Erkennung am Fensteranfang dieselben Vorgänger sieht.
const WARMUP_SECONDS=86400;

function counterZones(m5,instrument,t){
 const isForex=instrument!=='XAUUSD',conf=instrumentConfig(instrument),zones=[];
 for(const [tf,dur] of TIMEFRAMES){
  const c=dur===300?m5:aggregateCandles(m5,dur);
  for(const z of detectOrderBlocks(c,tf,isForex,obMinimum(instrument,tf)))
   zones.push({kind:'OB',tf,dir:z.dir,top:z.top,bottom:z.bottom,start:z.startTime,known:z.startTime+2*dur,
    dead:Math.min(z.touchedTime!=null?z.touchedTime+dur:Infinity,z.invalidated?z.endTime+dur:Infinity)});
  const clean=c.filter(x=>!x.ignored),min=isForex?FOREX_MIN_FVG_PIPS[tf]*conf.pip:conf.minFvg[tf]??0;
  for(let i=2;i<clean.length;i++)for(const dir of [1,-1]){
   const bottom=dir===1?clean[i-2].high:clean[i].high,top=dir===1?clean[i].low:clean[i-2].low;
   if(top-bottom<=Math.max(min,1e-9))continue;
   let dead=Infinity;
   for(let j=i+1;j<clean.length&&clean[j].time+dur<=t;j++)if(dir===1?clean[j].low<bottom:clean[j].high>top){dead=clean[j].time+dur;break;}
   zones.push({kind:'FVG',tf,dir,top,bottom,start:clean[i-1].time,known:clean[i].time+dur,dead});
  }
 }
 return zones;
}

// Treffer zum Entry (t = Start der Entry-M5). atr = H1-ATR der letzten geschlossenen Stunde; ohne ATR kein Urteil, also kein Treffer.
export function counterZoneHits(m5Candles,{instrument,entryTime,entryPrice,targetPrice,direction,atr}){
 if(!Number.isFinite(atr))return [];
 const t=Math.floor(entryTime/300)*300,since=t-COUNTER_ZONE_LOOKBACK_SECONDS,side=direction==='long'?1:-1,near=COUNTER_ZONE_NEAR_ATR*atr;
 return counterZones(candlesInWindow(m5Candles,since-WARMUP_SECONDS,t),instrument,t).filter(z=>z.dir===-side&&z.known<=t&&z.dead>t&&z.start>=since
  &&(side===-1?z.bottom<entryPrice&&z.top>=entryPrice-near&&z.top>targetPrice:z.top>entryPrice&&z.bottom<=entryPrice+near&&z.bottom<targetPrice));
}
