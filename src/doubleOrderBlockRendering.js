import {OrderBlockPrimitive} from './orderBlocks.js';
import {cssColor,cssColorScaled} from './chartColors.js';
import {doubleOrderBlockDisplay} from './doubleOrderBlocks.js';

const labels={pending:'wartet',invalid:'ungültig',unknown:'unbekannt',open:'offen',loss:'Loss',success:'2R',ambiguous:'unklar'};
export function renderDoubleOrderBlocks(series,pairs,candles,evaluatedAt) {
  const items=[];
  for(const pair of pairs) {
    const display=doubleOrderBlockDisplay(pair,evaluatedAt);
    if(!display.visible)continue;
    const color=display.tone==='red'?'tradeLoss':'tradeHover';
    const variants=Object.entries(display.variants).map(([key,value])=>`${key}: ${labels[value]??value}`).join(' · ');
    for(const [index,ob] of [pair.firstOrderBlock,pair.secondOrderBlock].entries()) {
      const endTime=Math.max(ob.startTime+300,pair.recognizedAt);
      const primitive=new OrderBlockPrimitive({...ob,touched:true,endTime},
        {fillColor:cssColorScaled(color,.12),borderColor:cssColor(color),textColor:cssColor(color),
          borderWidth:1,label:`DOB ${index+1}/2${index===1?' · '+variants:''}`},candles);
      series.attachPrimitive(primitive);items.push({pair,primitive});
    }
  }
  return items;
}

// Klick und Cursor benutzen dieselben wirklich gezeichneten Boxen, einschließlich Zoom/Snapping.
export function hitDoubleOrderBlock(items,x,y) {
  return [...items].reverse().find(({primitive})=>primitive.distanceTo(x,y)===0)?.pair??null;
}
