import {TradeMarkerPrimitive,tradeOptions} from './tradeMarkers.js';
import {LiquidityLinePrimitive} from './liquidity.js';
import {ScalePrimitive} from './scaleRendering.js';
import {entryRiskScale,entryRiskSpec} from './entryRisk.js';
import {cssColor} from './chartColors.js';
import {barSecondsFor} from './timeframes.js';

// Ein DOB-Statistik-Trade (Zeile aus dob_trade_setups) im Chart: Entry→Exit-Marke wie Journal-Trades, SL/TP nur vom Entry bis
// zum Exit (keine Linien über den ganzen Chart) und die R-Skala am Entry. Offene Trades laufen bis zur letzten Kerze.
const OUTCOME={success:'win',loss:'loss'};
export function dobTradePosition(row){
 return {id:row.id,direction:row.direction,entryTime:row.entry_time,entryPrice:row.entry_price,
  exitTime:row.exit_time,exitPrice:row.exit_price,outcome:OUTCOME[row.outcome]??null};
}

// Zieht Entry/SL/TP in die Preisskala, solange der Trade im sichtbaren Bereich liegt; sonst läge der TP oft außerhalb.
class DobTradeAutoscale {
 constructor(row,candles){
  const index=t=>{const i=candles.findIndex(c=>c.time>=t);return i<0?candles.length-1:i;};
  this.from=index(row.entry_time);this.to=row.exit_time==null?candles.length-1:index(row.exit_time);
  const prices=[row.entry_price,row.stop_price,row.target_price].filter(Number.isFinite);
  this.range={minValue:Math.min(...prices),maxValue:Math.max(...prices)};
 }
 paneViews(){return [];}
 autoscaleInfo(start,end){return end>=this.from&&start<=this.to?{priceRange:this.range}:null;}
}

export function renderDobTrade(series,row,primitives,candles,currentBar){
 for(const p of primitives)series.detachPrimitive(p);
 primitives.length=0;
 if(!row||!candles.length)return;
 const eventBarSeconds=barSecondsFor(currentBar),position=dobTradePosition(row);
 const endTime=row.exit_time??candles.at(-1).time;
 const add=p=>{series.attachPrimitive(p);primitives.push(p);};
 add(new TradeMarkerPrimitive(position,{...tradeOptions(position,true,false,false),eventBarSeconds},candles));
 for(const [price,styleKey,label] of [[row.stop_price,'tradeLoss','SL'],[row.target_price,'tradeWin','TP 2R']])
  if(Number.isFinite(price))add(new LiquidityLinePrimitive({price,pivotTime:row.entry_time,endTime},
   {color:cssColor(styleKey),lineWidth:1,label,labelSide:'end-above',forceLabel:true,eventBarSeconds},candles));
 const spec=entryRiskSpec(entryRiskScale(row.entry_price,row.stop_price,[{label:'TP',price:row.target_price}],row.instrument,row.direction),
  'SL','rScale',row.instrument);
 if(spec)add(new ScalePrimitive({...spec,startTime:row.entry_time},candles));
 add(new DobTradeAutoscale(row,candles));
}
