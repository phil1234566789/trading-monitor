import {instrumentConfig} from './instrumentConfig.js';

// SL-Baustein: SL 5 Ticks hinter den letzten Swing, der jenseits des bisherigen SL liegt (Long: Tief darunter, Short: Hoch darüber).
// Die Swings liefert der Struktur-Baustein (marketStructureSwings.js); hier wird nur ausgewählt und gepuffert. null = kein solcher Swing.
export const SWING_STOP_BUFFER_TICKS=5;
export function stopBehindSwing(swings,{direction,stopPrice,instrument}){
 const side=direction==='long'?1:-1,{tick,precision}=instrumentConfig(instrument);
 const best=swings.filter(p=>p.type===(side===1?'low':'high')&&(p.price-stopPrice)*side<0)
  .reduce((b,p)=>!b||p.pivotTime>b.pivotTime?p:b,null);
 return best&&{stopPrice:Number((best.price-side*SWING_STOP_BUFFER_TICKS*tick).toFixed(precision)),swingPrice:best.price,swingTime:best.pivotTime};
}
