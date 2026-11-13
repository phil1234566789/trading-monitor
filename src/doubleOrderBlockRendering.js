import {OrderBlockPrimitive,obZoneNaturalKey} from './orderBlocks.js';
import {cssColor,cssColorScaled} from './chartColors.js';
import {doubleOrderBlockDisplay} from './doubleOrderBlocks.js';
import {formatDatedTime} from './berlinTime.js';

const labels={pending:'wartet',invalid:'ungültig',unknown:'unbekannt',open:'offen',loss:'Loss',success:'2R',ambiguous:'unklar'};
export function renderDoubleOrderBlocks(series,pairs,candles,evaluatedAt) {
  const zones=new Map(),items=[];
  for(const pair of pairs) {
    const display=doubleOrderBlockDisplay(pair,evaluatedAt);
    if(!display.visible)continue;
    for(const [index,ob] of [pair.firstOrderBlock,pair.secondOrderBlock].entries()) {
      const key=obZoneNaturalKey('5M',ob.dir,ob.startTime),previous=zones.get(key);
      const endTime=Math.max(ob.startTime+300,pair.recognizedAt);
      zones.set(key,{ob,endTime:Math.max(previous?.endTime??0,endTime),second:index===1||previous?.second,
        pair:previous&&previous.pair.recognizedAt>pair.recognizedAt?previous.pair:pair});
    }
  }
  // Gemeinsame Zonen werden einmal gezeichnet; a/b-Details gehören in die Hover-Statuszeile.
  for(const {ob,endTime,second,pair} of zones.values()) {
    const color=doubleOrderBlockDisplay(pair,evaluatedAt).tone==='red'?'tradeLoss':'tradeHover';
    const primitive=new OrderBlockPrimitive({...ob,touched:true,endTime},
      {fillColor:cssColorScaled(color,.12),borderColor:cssColor(color),textColor:cssColor(color),borderWidth:1,label:second?'DOB':''},candles);
    series.attachPrimitive(primitive);items.push({pair,primitive});
  }
  return items;
}

export function doubleOrderBlockDetails(pair,evaluatedAt) {
  if(!pair)return '';
  const display=doubleOrderBlockDisplay(pair,evaluatedAt);
  const variants=Object.entries(display.variants).map(([key,value])=>`${key}: ${labels[value]??value}`).join(' · ');
  return `DOB · ${formatDatedTime(pair.firstOrderBlock.startTime)} → ${formatDatedTime(pair.secondOrderBlock.startTime)} · ${variants}`;
}

// Klick und Cursor benutzen dieselben wirklich gezeichneten Boxen, einschließlich Zoom/Snapping.
export function hitDoubleOrderBlock(items,x,y) {
  return [...items].reverse().find(({primitive})=>primitive.distanceTo(x,y)===0)?.pair??null;
}
