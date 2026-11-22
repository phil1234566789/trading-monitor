import {counterZoneHits,COUNTER_ZONE_LOOKBACK_SECONDS} from './antiConfluenceCounterZones.js';
import {untouchedSwingsAsOf} from './marketStructureSwings.js';
import {stopBehindSwing,slAlgoApplies,SL_ALGO_TIMEFRAME_SECONDS} from './slAlgo.js';
import {h1AtrAt} from './dobHtfObPoi.js';
import {DOB_DEFAULT_TP_R} from './dobGuardrails.js';

// SL-Algo im DOB (src/slAlgo.js): Trifft die Anti-Confluence „breit“ den Entry, wird nicht gesperrt, der SL kommt nach der Methode
// der Konfig. Das Ziel bleibt als Preis. Der Treffer prüft gegen das DOB-Ziel 2R wie die Messung, unabhängig vom Konfig-TP.
// Wie createDobCounterDobGate: einmal mit allen M5 (markiert) erzeugt, dann je Setup mit Konfig und POI-Art; atr = Serie aus
// dobH1AtrSeries. null = Methode greift nicht oder keine Anti-Confluence; {hits, stop:null} = kein Swing jenseits des DOB-SL.
export function createDobSwingStopGate({m5Candles,instrument,atr}){
 return (setup,algo,poiType)=>{
  if(setup.entryTime==null||!slAlgoApplies(algo,poiType))return null;
  const side=setup.direction==='long'?1:-1,risk=Math.abs(setup.entryPrice-setup.stopPrice),t=Math.floor(setup.entryTime/300)*300;
  const hits=counterZoneHits(m5Candles,{instrument,entryTime:setup.entryTime,entryPrice:setup.entryPrice,direction:setup.direction,
   targetPrice:setup.entryPrice+side*DOB_DEFAULT_TP_R*risk,atr:h1AtrAt({atr},t)});
  if(!hits.length)return null;
  const swings=untouchedSwingsAsOf(m5Candles,{asOf:t,since:t-COUNTER_ZONE_LOOKBACK_SECONDS,barSeconds:SL_ALGO_TIMEFRAME_SECONDS[algo.timeframe],period:2});
  return {hits:hits.map(({kind,tf,start,top,bottom})=>({kind,tf,start,top,bottom})),
   stop:stopBehindSwing(swings,{direction:setup.direction,stopPrice:setup.stopPrice,instrument,bufferTicks:algo.bufferTicks})};
 };
}
