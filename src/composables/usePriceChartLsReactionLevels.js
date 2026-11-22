import {SessionBandPrimitive} from '../sessions.js';
import {cssColor} from '../chartColors.js';
import {lsReactionLevelBands} from '../lsReactionChain.js';

// Struktur-Ebenen als Zeitbänder über die volle Panehöhe; Debugger und Hauptchart zeichnen gleich.
export function drawLsReactionLevels(series,chain,candles){
 const end=candles.at(-1)?.time;
 return lsReactionLevelBands(chain,end).map(b=>{const up=b.trend==='uptrend';
  const p=new SessionBandPrimitive(b.from,b.to,{fill:cssColor(up?'m5LevelUp':'m5LevelDown'),
   label:b.label,labelColor:cssColor(up?'rangeLiveUptrend':'rangeLiveDowntrend')},{candles});
  series.attachPrimitive(p);return p;});
}

export function usePriceChartLsReactionLevels(){
 let primitives=[],series=null;
 function clear(){primitives.forEach(p=>series?.detachPrimitive(p));primitives=[];}
 function render(target,{chain,candles,show}){
  clear();series=target;
  if(show&&target&&candles?.length)primitives=drawLsReactionLevels(target,chain,candles);
 }
 return {render,clear};
}
