import {RangeLinePrimitive} from '../marketStructureRendering';
import {cssColor} from '../chartColors.js';
import {ts11LevelLegs} from '../ts11Chain.js';

// TS1.1-Ebenen als beschriftete Zickzack-Schenkel; Debugger und Hauptchart zeichnen gleich.
export function drawTs11Levels(series,chain,candles,barSeconds){
 return ts11LevelLegs(chain).map(l=>{
  const p=new RangeLinePrimitive(l.points,{color:cssColor(l.trend==='uptrend'?'rangeLiveUptrend':'rangeLiveDowntrend'),
   lineWidth:3,eventBarSeconds:barSeconds,label:l.label},candles);
  series.attachPrimitive(p);return p;});
}

export function usePriceChartTs11Levels(){
 let primitives=[],series=null;
 function clear(){primitives.forEach(p=>series?.detachPrimitive(p));primitives=[];}
 function render(target,{chain,candles,show,barSeconds}){
  clear();series=target;
  if(show&&target&&candles?.length)primitives=drawTs11Levels(target,chain,candles,barSeconds);
 }
 return {render,clear};
}
