import {OrderBlockPrimitive} from './orderBlocks.js';
import {LiquidityLinePrimitive} from './liquidity.js';
import {TradeMarkerPrimitive,tradeOptions} from './tradeMarkers.js';
import {cssColor,cssColorScaled} from './chartColors.js';
import {validTradeIdea} from './tradeIdeas.js';
export function renderTradeIdeas(series,annotations,primitives,candles,barSeconds,onLine=()=>{}) {
 for(const annotation of annotations) {
  const i=annotation.tradeIdea;
  if(!validTradeIdea(i))continue;
  const options={futureBarSeconds:barSeconds,lineWidth:1,labelSide:'end-above',lenientLabels:true};
  const add=p=>{series.attachPrimitive(p);primitives.push(p);};
  for(const [price,key,label] of [[i.sl,'candleDown','SL'],[i.tp,'candleUp','TP']]) {
   if(price==null)continue;
   add(new OrderBlockPrimitive({top:Math.max(price,i.entry),bottom:Math.min(price,i.entry),startTime:i.time,endTime:i.endTime,touched:true},
    {...options,fillColor:cssColorScaled(key,.12),borderColor:cssColor(key),borderWidth:1,textColor:cssColor(key)},candles));
   const line=new LiquidityLinePrimitive({price,pivotTime:i.time,endTime:i.endTime},{...options,color:cssColor(key),label:`Idee ${label} ${price} · ziehen`},candles);
   add(line);onLine(line,annotation,label.toLowerCase());
  }
  const anchor=new LiquidityLinePrimitive({price:i.entry,pivotTime:i.time,endTime:i.endTime},
   {...options,color:cssColor('tradeConnector'),label:`${i.direction==='long'?'Long':'Short'}-Idee · Anker ${i.entry} · kein Entry · ziehen`},candles);
  add(anchor);onLine(anchor,annotation,'entry');
 }
}
export function renderBrokerTrades(series,trades,primitives,candles) {
 for(const trade of trades) {
  const marker=new TradeMarkerPrimitive(trade,tradeOptions(trade,true,false,false),candles);
  series.attachPrimitive(marker);primitives.push(marker);
  if(Number.isFinite(trade.stopLoss)&&candles.length){
   const stop=new LiquidityLinePrimitive({price:trade.stopLoss,pivotTime:trade.entryTime,endTime:trade.exitTime??candles[candles.length-1].time},
    {color:cssColor('candleDown'),lineWidth:1,label:`Initialer SL ${trade.stopLoss} · RR-Basis`,labelSide:'end-below'},candles);
   series.attachPrimitive(stop);primitives.push(stop);
  }
 }
}
