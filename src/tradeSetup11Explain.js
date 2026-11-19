import {formatBerlinTime,formatDatedTime} from './berlinTime.js';
import {fmtPrice,pricePrecisionForInstrument} from './format.js';

// Klartext zur TS1.1-Quellenprüfung, damit Philip jeden Schritt ohne Code nachvollziehen kann; der Code steht klein dahinter.
const TREND={uptrend:'Aufwärts',downtrend:'Abwärts'};
const day=t=>formatDatedTime(t).slice(0,10);
export const ts11When=(t,ref)=>t==null?'–':ref!=null&&day(t)===day(ref)?formatBerlinTime(t):formatDatedTime(t);
export const ts11TrendText=t=>TREND[t]??t;
// Präzision je Instrument: Forex braucht 5 Stellen, sonst stünde bei GBP nur „1,31“.
export const ts11Price=(price,instrument)=>fmtPrice(price,pricePrecisionForInstrument(instrument));
export const ts11Point=(p,ref,instrument)=>p?`${ts11Price(p.price,instrument)} (${ts11When(p.pivotTime,ref)})`:'–';

export function explainTs11Source({assessment,source,dir,evaluatedAt,instrument}){
 const w=t=>ts11When(t,evaluatedAt),ev=assessment.trendEvidence??{},cur=ev.currentRange,owner=ev.sourceOwner;
 const expected=dir===1?'Abwärts':'Aufwärts',isOb=source.level.sourceKind==='orderBlock';
 const pivot=owner?.pivot?.pivotTime??source.level.pivotTime;
 const prefix=isOb&&owner?.pivot?`OB-Quelle über Ursprungspivot ${ts11Price(owner.pivot.price,instrument)} (${w(owner.pivot.pivotTime)}): `:'';
 // Nur eine Gegen-Range hat einen Ursprung, an dem die Gegenbewegung beginnt; im Trend wäre der Satz falsch (P483).
 const counter=ev.counterOrigin??(cur?.basis==='existingCloseReactionChoch'&&cur.trend!==(dir===1?'downtrend':'uptrend')?cur.confirmation?.originTime:null);
 const extreme=cur?.trend==='uptrend'?'Range-Low':'Range-High';
 const range=owner?.range&&`${ts11TrendText(owner.range.trend)}-${owner.depth===0?'Wurzel':`Range Tiefe ${owner.depth}`}`;
 let text;
 switch(assessment.reason){
  case 'currentTrendDirection':text=`aktuelle Range (Tiefe ${cur.depth}, ${ts11TrendText(cur.trend)}) läuft schon in Setup-Richtung → zählt`;break;
  case 'sourceRangeDirection':
   text=owner.basis==='deepestRangeAtLevelBirth'
    ?owner.depth===0&&counter!=null
     ?`LS-Pivot ${w(pivot)} gehört zur ${range} und ist älter als das ${extreme} ${w(counter)}, an dem die Gegen-Range (Close-CHoCH) beginnt → zählt`
     :`LS-Pivot ${w(pivot)} gehört bei seiner Entstehung zur ${range} → zählt`
    :owner.basis==='rangeBoundaryBeforeSweep'?`LS-Pivot ${w(pivot)} ist Range-Grenze der ${range} vor dem Sweep → zählt`
    :`LS-Pivot ${w(pivot)} ist geschützter Pivot der ${range} vor dem Sweep → zählt`;
   break;
  case 'sourceRangeNotAssociated':
   text=counter!=null&&pivot>counter
    ?`LS-Pivot ${w(pivot)} liegt nach dem ${extreme} ${w(counter)} und gehört damit zur Gegenbewegung → zählt nicht`
    :`LS-Pivot ${w(pivot)} gehört weder bei seiner Entstehung noch vor dem Sweep zu einer ${expected}-Range unter der Wurzel → zählt nicht`;
   break;
  case 'sourcePivotInCounterMove':
   text=`LS-Pivot ${w(pivot)} liegt nicht vor dem ${dir===1?'Range-Low':'Range-High'} ${w(ev.counterOrigin)}, an dem die Bewegung zum Sweep beginnt → zählt nicht`;break;
  case 'orderBlockSourceRangeNotAssociated':
   text=`kein erkannter Ursprungspivot dieses OB gehört zu einer ${expected}-Range → zählt nicht`;break;
  default:text=assessment.status==='passed'?'zählt':assessment.status==='unknown'?'nicht entscheidbar':'zählt nicht';
 }
 return `${prefix}${text}`;
}
