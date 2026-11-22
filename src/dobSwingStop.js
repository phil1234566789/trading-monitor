import {counterZoneHits,COUNTER_ZONE_LOOKBACK_SECONDS} from './antiConfluenceCounterZones.js';
import {untouchedSwingsAsOf} from './marketStructureSwings.js';
import {stopBehindSwing} from './swingStop.js';
import {h1AtrAt} from './dobHtfObPoi.js';
import {DOB_DEFAULT_TP_R} from './dobGuardrails.js';

// DOB-SL-Variante (c), nur POI-Art HTF-OB (Philip 22.11.): Trifft die Anti-Confluence „breit“ den Entry, wird nicht gesperrt, der SL
// kommt 5 Ticks hinter den letzten bestätigten, bis zum Entry unberührten M15-P2 der letzten 2 Tage. Das Ziel bleibt als Preis.
// Bei LQ-Sweep trägt der Strukturpunkt nichts gegenüber einem gleich weiten Zufalls-SL (analysis/lq2-sweeps, Gegenprobe zu (c)).
// Der Treffer prüft gegen das DOB-Ziel 2R wie die Messung, unabhängig vom Konfig-TP. Wie createDobCounterDobGate: einmal mit allen
// M5 (markiert) erzeugt, dann je Setup; atr = Serie aus dobH1AtrSeries. null = keine Anti-Confluence; {hits, stop:null} = kein Swing.
export function createDobSwingStopGate({m5Candles,instrument,atr}){
 return setup=>{
  if(setup.entryTime==null)return null;
  const side=setup.direction==='long'?1:-1,risk=Math.abs(setup.entryPrice-setup.stopPrice),t=Math.floor(setup.entryTime/300)*300;
  const hits=counterZoneHits(m5Candles,{instrument,entryTime:setup.entryTime,entryPrice:setup.entryPrice,direction:setup.direction,
   targetPrice:setup.entryPrice+side*DOB_DEFAULT_TP_R*risk,atr:h1AtrAt({atr},t)});
  if(!hits.length)return null;
  const swings=untouchedSwingsAsOf(m5Candles,{asOf:t,since:t-COUNTER_ZONE_LOOKBACK_SECONDS,barSeconds:900,period:2});
  return {hits:hits.map(({kind,tf,start,top,bottom})=>({kind,tf,start,top,bottom})),
   stop:stopBehindSwing(swings,{direction:setup.direction,stopPrice:setup.stopPrice,instrument})};
 };
}
