import {instrumentConfig} from './instrumentConfig.js';

// SL-Algo: wählt per Konfig die SL-Methode je Instrument und POI-Art (dob_guardrails.sl_algo). dob = SL des DOB-Indikators.
// 1.0 (Philip 22.11.): structure_p2 = 5 Ticks hinter den letzten bestätigten, bis zum Entry unberührten M15-P2 jenseits des DOB-SL,
// nur HTF-OB (bei LQ-Sweep trägt der Strukturpunkt nichts gegenüber einem Zufalls-SL gleicher Weite). Ein engerer SL kommt später
// als weitere Methode dazu. Die Swings liefert der Struktur-Baustein (marketStructureSwings.js); hier wird nur ausgewählt und gepuffert.
export const SL_ALGO_METHOD_LABELS={dob:'DOB-SL',structure_p2:'Struktur-P2'};
export const SL_ALGO_DEFAULT=Object.freeze({method:'dob'});
export const SL_ALGO_V1=Object.freeze({method:'structure_p2',timeframe:'15M',bufferTicks:5,poiTypes:Object.freeze(['htf_ob'])});
export const SL_ALGO_TIMEFRAME_SECONDS={'5m':300,'15M':900,'1H':3600};
// DB-Wert (jsonb) → Konfig; unbekannte Methoden fallen auf den DOB-SL zurück, fehlende Parameter auf 1.0.
export function slAlgoFromJson(value){
 if(value?.method!=='structure_p2')return SL_ALGO_DEFAULT;
 return {...SL_ALGO_V1,...value,poiTypes:Array.isArray(value.poiTypes)?value.poiTypes:SL_ALGO_V1.poiTypes};
}
export const slAlgoApplies=(algo,poiType)=>algo?.method==='structure_p2'&&(algo.poiTypes??[]).includes(poiType);
export const slAlgoText=algo=>algo?.method==='structure_p2'
 ?`SL-Algo: ${SL_ALGO_METHOD_LABELS.structure_p2} ${algo.timeframe} + ${algo.bufferTicks} Ticks bei Anti-Confluence`:SL_ALGO_METHOD_LABELS.dob;

export function stopBehindSwing(swings,{direction,stopPrice,instrument,bufferTicks=SL_ALGO_V1.bufferTicks}){
 const side=direction==='long'?1:-1,{tick,precision}=instrumentConfig(instrument);
 const best=swings.filter(p=>p.type===(side===1?'low':'high')&&(p.price-stopPrice)*side<0)
  .reduce((b,p)=>!b||p.pivotTime>b.pivotTime?p:b,null);
 return best&&{stopPrice:Number((best.price-side*bufferTicks*tick).toFixed(precision)),swingPrice:best.price,swingTime:best.pivotTime};
}
