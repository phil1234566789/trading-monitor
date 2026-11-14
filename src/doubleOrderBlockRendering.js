import {OrderBlockPrimitive,obZoneNaturalKey} from './orderBlocks.js';
import {cssColor,cssColorScaled} from './chartColors.js';
import {doubleOrderBlockDisplay} from './doubleOrderBlocks.js';
import {formatDatedTime} from './berlinTime.js';
import {fmtPrice,pricePrecisionForInstrument} from './format.js';

const labels={pending:'wartet',invalid:'ungültig',unknown:'unbekannt',open:'offen',loss:'Loss',success:'2R',ambiguous:'unklar'};
export function renderDoubleOrderBlocks(series,pairs,candles,evaluatedAt,{selectedPairId,pinnedPairIds=new Set(),pairEvaluatedAt=new Map()}={}) {
  const zones=new Map(),items=[];
  for(const pair of pairs) {
    const display=doubleOrderBlockDisplay(pair,pairEvaluatedAt.get(pair.id)??evaluatedAt);
    if(!display.visible)continue;
    for(const [index,ob] of [pair.firstOrderBlock,pair.secondOrderBlock].entries()) {
      const key=obZoneNaturalKey('5M',ob.dir,ob.startTime),previous=zones.get(key);
      const endTime=Math.max(ob.startTime+300,pair.recognizedAt);
      const associated=[...(previous?.pairs??[]).filter(p=>p.id!==pair.id),pair];
      zones.set(key,{ob,endTime:Math.max(previous?.endTime??0,endTime),roles:new Set([...(previous?.roles??[]),index+1]),pairs:associated,
        pair:associated.find(p=>p.id===selectedPairId)??(previous&&previous.pair.recognizedAt>pair.recognizedAt?previous.pair:pair)});
    }
  }
  // Gemeinsame Zonen werden einmal gezeichnet; a/b-Details gehören in die Hover-Statuszeile.
  for(const {ob,endTime,roles,pair,pairs:associated} of zones.values()) {
    const selected=associated.find(p=>p.id===selectedPairId);
    const role=selected?(selected.firstOrderBlock.startTime===ob.startTime?'1':'2'):[...roles].sort().join('/');
    const color=doubleOrderBlockDisplay(pair,pairEvaluatedAt.get(pair.id)??evaluatedAt).tone==='red'?'tradeLoss':'tradeHover';
    const primitive=new OrderBlockPrimitive({...ob,touched:true,endTime},
      {fillColor:cssColorScaled(color,.12),borderColor:cssColor(color),textColor:cssColor(color),borderWidth:1,
        label:`DOB${role} ${pair.direction==='long'?'L':'S'}`,
        inPinContext:associated.some(p=>pinnedPairIds.has(p.id)),pinColor:cssColor('pin'),
        isSelectedPin:associated.some(p=>p.id===selectedPairId),hoverColor:cssColor('tradeHover')},candles);
    series.attachPrimitive(primitive);items.push({pair,pairs:associated,primitive});
  }
  return items;
}

export function doubleOrderBlockDetails(pair,evaluatedAt,visibleRange) {
  if(!pair)return '';
  const display=doubleOrderBlockDisplay(pair,evaluatedAt);
  const variants=Object.entries(display.variants).map(([key,value])=>`${key}: ${labels[value]??value}`).join(' · ');
  const precision=pricePrecisionForInstrument(pair.instrument);
  const obText=(ob,label)=>`${label} ${formatDatedTime(ob.startTime)} ${fmtPrice(ob.bottom,precision)}–${fmtPrice(ob.top,precision)}`;
  const first=pair.firstOrderBlock.startTime;
  const offscreen=visibleRange&&typeof visibleRange.from==='number'&&(first<visibleRange.from||first>visibleRange.to);
  return `DOB ${pair.direction==='long'?'Long':'Short'} · ${obText(pair.firstOrderBlock,'OB1')}${offscreen?' (außerhalb Sichtbereich)':''} → ${obText(pair.secondOrderBlock,'OB2')} · ${variants}`;
}

// Klick und Cursor benutzen dieselben wirklich gezeichneten Boxen, einschließlich Zoom/Snapping.
export function hitDoubleOrderBlock(items,x,y) {
  return [...items].reverse().find(({primitive})=>primitive.distanceTo(x,y)===0)?.pair??null;
}
