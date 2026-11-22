import {TradeMarkerPrimitive,tradeOptions} from './tradeMarkers.js';
import {LiquidityLinePrimitive} from './liquidity.js';
import {ScalePrimitive} from './scaleRendering.js';
import {entryRiskScale,entryRiskSpec} from './entryRisk.js';
import {cssColor,cssColorScaled} from './chartColors.js';
import {OrderBlockPrimitive} from './orderBlocks.js';
import {dobPoiLabel,dobTs11Label} from './dobPoiLabel.js';
import {barSecondsFor} from './timeframes.js';
import {lineWidth} from './chartLineWidths.js';
import {fmtPrice,pricePrecisionForInstrument} from './format.js';
import {formatBerlinTime} from './berlinTime.js';
import {TRADE_SETUP_OB_WIDTH_SEC,TRADE_SETUP_OB_FILL_RATIO,TRADE_SETUP_OB_BORDER_RATIO} from './priceChartConstants.js';

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
  const prices=[row.entry_price,row.stop_price,row.target_price,row.poi_zone_top,row.poi_zone_bottom].filter(Number.isFinite);
  this.range={minValue:Math.min(...prices),maxValue:Math.max(...prices)};
 }
 paneViews(){return [];}
 autoscaleInfo(start,end){return end>=this.from&&start<=this.to?{priceRange:this.range}:null;}
}

// Ausschnitt beim Sprung: ab Retest des POI (falls vorhanden), sonst ab Entry, bis Exit.
export function dobTradeFrame(row){
 const retest=Number.isFinite(row.poi_retest_age_seconds)?row.first_ob_start-row.poi_retest_age_seconds:Infinity;
 // LQ-Sweep: ab dem gesweepten Level des TS1.1, damit Pivot und Sweep im Bild sind.
 const lsPivot=row.ts11?dobTs11Ls(row).pivotTime:Infinity;
 return {from:Math.min(row.entry_time,retest,Number.isFinite(lsPivot)?lsPivot:Infinity),to:row.exit_time??row.entry_time};
}

// LS des LQ-Sweep-POI = bestandene TS1.1-Quelle, die der Lauf gespeichert hat (features.poi_ls_*); ältere Läufe ohne sie zeigen die
// Primär-LS der trade_setups-Zeile (row.ts11).
function dobTs11Ls(row){
 const f=row.features??{},ts=row.ts11,sec=t=>Date.parse(t)/1000;
 return Number.isFinite(f.poi_ls_price)?{price:f.poi_ls_price,pivotTime:f.poi_ls_pivot_time,touchedTime:f.poi_ls_touched_time}
  :{price:ts.ls_price==null?null:Number(ts.ls_price),pivotTime:sec(ts.ls_pivot_time),touchedTime:sec(ts.ls_touched_time)};
}

// Entry→Exit-Marke plus SL/TP vom Entry bis endTime; geteilt von Detail-Sprung (renderDobTrade) und Lauf-Positionen im Hauptchart.
// labels: Marken- und Linien-Labels immer zeigen (Einzel-Trade); muted: grau (gesperrter Trade, nur zur Ansicht).
export function addDobPosition(add,{position,stopPrice,targetPrice,targetLabel,endTime},candles,eventBarSeconds,{labels=false,muted=false}={}){
 const grey=cssColor('tradeInvalid');
 const greyed=muted?{entryColor:grey,entryColorKey:'tradeInvalid',exitColor:grey,exitColorKey:'tradeInvalid',connectorColor:grey}:{};
 add(new TradeMarkerPrimitive(position,{...tradeOptions(position,labels,false,false),...greyed,eventBarSeconds},candles));
 for(const [price,styleKey,label] of [[stopPrice,'tradeLoss','SL'],[targetPrice,'tradeWin',targetLabel]])
  if(Number.isFinite(price))add(new LiquidityLinePrimitive({price,pivotTime:position.entryTime,endTime},
   {color:muted?grey:cssColor(styleKey),lineWidth:1,label,labelSide:'end-above',forceLabel:labels,eventBarSeconds},candles));
}

export function renderDobTrade(series,row,primitives,candles,currentBar,targetLabel='TP 2R'){
 for(const p of primitives)series.detachPrimitive(p);
 primitives.length=0;
 if(!row||!candles.length)return;
 const eventBarSeconds=barSecondsFor(currentBar),position=dobTradePosition(row);
 const endTime=row.exit_time??candles.at(-1).time;
 const add=p=>{series.attachPrimitive(p);primitives.push(p);};
 addDobPosition(add,{position,stopPrice:row.stop_price,targetPrice:row.target_price,targetLabel,endTime},candles,eventBarSeconds,{labels:true});
 const spec=entryRiskSpec(entryRiskScale(row.entry_price,row.stop_price,[{label:'TP',price:row.target_price}],row.instrument,row.direction),
  'SL','rScale',row.instrument);
 if(spec)add(new ScalePrimitive({...spec,startTime:row.entry_time},candles));
 if(row.poi_kind==='ts11'){if(row.ts11)addTs11Poi(add,row,candles,eventBarSeconds);}
 // POI (v1/v2): H1/H4-Zone golden ab Zonenstart bis Exit, dazu der Retest (Start der letzten Touch-Episode vor OB1)
 // als kurze Marke an der Kante, an der der Preis die Zone berührt. Vor dem Kerzenfenster beginnende Zonen starten am Fensterrand.
 else if([row.poi_zone_top,row.poi_zone_bottom,row.poi_zone_start].every(Number.isFinite)){
  add(new OrderBlockPrimitive({top:row.poi_zone_top,bottom:row.poi_zone_bottom,startTime:row.poi_zone_start,
   drawStartTime:Math.max(row.poi_zone_start,candles[0].time),endTime,touched:true},
   {fillColor:cssColorScaled('dobPoi',.18),borderColor:cssColor('dobPoi'),textColor:cssColor('dobPoi'),borderWidth:2,
    label:`POI ${dobPoiLabel(row)}`,forceLabel:true,eventBarSeconds},candles));
  if(Number.isFinite(row.poi_retest_age_seconds)){
   const retest=row.first_ob_start-row.poi_retest_age_seconds;
   add(new LiquidityLinePrimitive({price:row.direction==='long'?row.poi_zone_top:row.poi_zone_bottom,pivotTime:retest,endTime:retest+3*eventBarSeconds},
    {color:cssColor('dobPoi'),lineWidth:4,label:'Retest',labelSide:'end-above',forceLabel:true,eventBarSeconds},candles));
  }
 }
 add(new DobTradeAutoscale(row,candles));
}

// LQ-Sweep-POI (Philip: der goldene „POI … Überlappung“-Kasten sagt nichts): stattdessen das TS1.1-Setup wie im Chart sonst,
// gesweepte LS-Linie vom Pivot bis zum Sweep plus kurze Sweep-Marke und die TS1.1-OB-Box, Farben/Breiten wie
// usePriceChartTradeSetupDrawing (tradeSetupShort/-Long). ts11 = trade_setups-Zeile, geladen in useDobChartRoute.
function addTs11Poi(add,row,candles,eventBarSeconds){
 const ts=row.ts11,key=ts.direction==='short'?'tradeSetupShort':'tradeSetupLong',sec=t=>Date.parse(t)/1000;
 const obStart=sec(ts.ob_start_time),price=v=>fmtPrice(Number(v),pricePrecisionForInstrument(row.instrument));
 const {price:lsPrice,pivotTime:lsPivot,touchedTime:swept}=dobTs11Ls(row);
 if([lsPivot,swept].every(Number.isFinite)&&lsPrice!=null){
  add(new LiquidityLinePrimitive({price:Number(lsPrice),pivotTime:Math.max(lsPivot,candles[0].time),endTime:swept},
   {color:cssColor(key),lineWidth:lineWidth(key),label:`LS ${price(lsPrice)}`,labelSide:'end-above',forceLabel:true,eventBarSeconds},candles));
  add(new LiquidityLinePrimitive({price:Number(lsPrice),pivotTime:swept,endTime:swept+3*eventBarSeconds},
   {color:cssColor(key),lineWidth:4,label:`Sweep ${formatBerlinTime(swept)}`,labelSide:'end-below',forceLabel:true,eventBarSeconds},candles));
 }
 if(Number.isFinite(obStart))add(new OrderBlockPrimitive({top:Number(ts.ob_top),bottom:Number(ts.ob_bottom),startTime:obStart,
  drawStartTime:Math.max(obStart,candles[0].time),endTime:obStart+TRADE_SETUP_OB_WIDTH_SEC,touched:true},
  {fillColor:cssColorScaled(key,TRADE_SETUP_OB_FILL_RATIO),borderColor:cssColorScaled(key,TRADE_SETUP_OB_BORDER_RATIO),borderWidth:lineWidth(key),
   textColor:'rgba(255, 255, 255, 0.9)',forceLabel:true,eventBarSeconds,
   label:dobTs11Label({tradeSetupId:ts.id,match:row.features?.poi_match,gapUsd:row.features?.poi_gap_usd})},candles));
}
