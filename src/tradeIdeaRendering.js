import {OrderBlockPrimitive} from './orderBlocks.js';
import {LiquidityLinePrimitive} from './liquidity.js';
import {TradeMarkerPrimitive,tradeOptions} from './tradeMarkers.js';
import {cssColor,cssColorScaled} from './chartColors.js';
import {validTradeIdea} from './tradeIdeas.js';
export function renderTradeIdeas(series,annotations,primitives,candles,barSeconds) {
 for(const {tradeIdea:i} of annotations) {
  if(!validTradeIdea(i))continue;
  const options={futureBarSeconds:barSeconds,lineWidth:1,labelSide:'end-above',lenientLabels:true};
  const add=p=>{series.attachPrimitive(p);primitives.push(p);};
  for(const [price,key,label] of [[i.sl,'candleDown','SL'],[i.tp,'candleUp','TP']]) {
   if(price==null)continue;
   add(new OrderBlockPrimitive({top:Math.max(price,i.entry),bottom:Math.min(price,i.entry),startTime:i.time,endTime:i.endTime,touched:true},
    {...options,fillColor:cssColorScaled(key,.12),borderColor:cssColor(key),borderWidth:1,textColor:cssColor(key)},candles));
   add(new LiquidityLinePrimitive({price,pivotTime:i.time,endTime:i.endTime},{...options,color:cssColor(key),label:`Idee ${label} ${price}`},candles));
  }
  add(new LiquidityLinePrimitive({price:i.entry,pivotTime:i.time,endTime:i.endTime},
   {...options,color:cssColor('tradeConnector'),label:`${i.direction==='long'?'Long':'Short'}-Idee · Anker ${i.entry} · kein Entry`},candles));
 }
}
export function renderBrokerTrades(series,trades,primitives,candles) {
 for(const trade of trades) {
  const marker=new TradeMarkerPrimitive(trade,tradeOptions(trade,true,false,false),candles);
  series.attachPrimitive(marker);primitives.push(marker);
 }
}
