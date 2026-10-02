import {TradeMarkerPrimitive,tradeOptions} from './tradeMarkers.js';
import {LiquidityLinePrimitive} from './liquidity.js';
import {OrderBlockPrimitive} from './orderBlocks.js';
import {DivergenceLinePrimitive} from './rsiRendering.js';
import {RangeLinePrimitive} from './marketStructureRendering';
import {renderM1Entry} from './m1EntryRendering.js';
import {cssColor,cssColorScaled} from './chartColors.js';
import {lineWidth} from './chartLineWidths.js';
import {barSecondsFor} from './timeframes.js';
import {snapshotEvidenceVisible} from './tradeSetup2SnapshotIndicators.js';

export function clearSetup2Primitives(series,primitives) {
  for(const p of primitives) series.detachPrimitive(p);
  primitives.length=0;
}

export function renderSetup2Positions(series,positions,primitives,candles,currentBar,selectedId) {
  clearSetup2Primitives(series,primitives);
  if(!['1m','5m'].includes(currentBar))return;
  for(const position of positions) {
    if(position.kind==='candidate') {
      for(const bound of position.bounds) {
        const p=new LiquidityLinePrimitive({price:bound.price,pivotTime:position.fromTime,endTime:position.toTime},
          {color:cssColor(bound.styleKey),lineWidth:position.snapshotId===selectedId?2:1,
            label:`${bound.label} · ${position.candidateStatus}`,eventBarSeconds:barSecondsFor(currentBar)},candles);
        p.historyItem=position;
        series.attachPrimitive(p);primitives.push(p);
      }
      continue;
    }
    const p=new TradeMarkerPrimitive(position,{...tradeOptions(position,false,position.snapshotId===selectedId,false),
      eventBarSeconds:barSecondsFor(currentBar)},candles);
    series.attachPrimitive(p); primitives.push(p);
    if(position.t1Time!=null && Number.isFinite(position.t1Price)) {
      const partial=new LiquidityLinePrimitive({price:position.t1Price,pivotTime:position.t1Time,endTime:position.t1Time+30},
        {color:cssColor('tradeWin'),lineWidth:2,label:'T1 · 50%',eventBarSeconds:barSecondsFor(currentBar)},candles);
      series.attachPrimitive(partial);primitives.push(partial);
    }
  }
}

export function renderSetup2Detail(series,snapshot,primitives,entryPrimitives,candles,currentBar,asOf,indicators) {
  clearSetup2Primitives(series,primitives);
  const visible=['1m','5m'].includes(currentBar)&&snapshot?.knownAt<=asOf?snapshot:null;
  renderM1Entry(series,visible?.entry,entryPrimitives,candles,currentBar);
  if(!visible)return;
  for(const e of visible.evidence) {
    if(e.knownAt>asOf || !snapshotEvidenceVisible(e,indicators))continue;
    // Ein H1-Level kann vor dem geladenen M1-Fenster beginnen. Nur horizontale
    // Belege am Fensterrand abschneiden; schräge Strukturpfade nicht extrapolieren.
    const fromTime=e.kind==='segment'?e.fromTime:Math.max(e.fromTime,candles[0]?.time ?? e.fromTime);
    if(e.kind!=='segment'&&fromTime>e.toTime)continue;
    const options={color:cssColor(e.styleKey),lineWidth:lineWidth(e.styleKey),label:e.label,
      eventBarSeconds:barSecondsFor(currentBar)};
    let p;
    if(e.kind==='zone')p=new OrderBlockPrimitive({top:e.top,bottom:e.bottom,startTime:fromTime,endTime:e.toTime,touched:true},
      {...options,fillColor:e.role==='reactionOB'?cssColor(e.styleKey):cssColorScaled(e.styleKey,0.15),
        borderColor:cssColorScaled(e.styleKey,e.role==='reactionOB'?2.5:1),borderWidth:1,textColor:cssColor(e.styleKey)},candles);
    else if(e.kind==='segment'&&e.role==='structure')p=new RangeLinePrimitive([
      {pivotTime:e.fromTime,price:e.fromPrice},{pivotTime:e.toTime,price:e.toPrice}],options,candles);
    else if(e.kind==='segment')p=new DivergenceLinePrimitive({time:e.fromTime,price:e.fromPrice},{time:e.toTime,price:e.toPrice},
      {...options,label:e.role==='structure'?'':e.label},candles);
    else p=new LiquidityLinePrimitive({price:e.price,pivotTime:fromTime,endTime:e.toTime},options,candles);
    series.attachPrimitive(p);primitives.push(p);
  }
}
