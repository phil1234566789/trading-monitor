import {internalFvgOpenAt} from './orderBlockReaction.js';
import {internalFvgSources,internalFvgPlacement,fvgFillChangeAt} from './obReactionGraph.js';
import {formatBerlinTime} from './berlinTime.js';

// Die Auswahl gehört dem Produkt: Boxen und Seitenspur übernehmen dasselbe Inventar des ausgewählten OB.
export function chartDebuggerFvgZones(entry,context,evaluatedAt){
 if(!entry?.orderBlock)return [];
 return internalFvgSources(entry).map(fvg=>fvgZone(fvg,context,evaluatedAt,internalFvgPlacement(fvg,entry.orderBlock)==='intern'?'Int. M1-FVG':'Überl. M1-FVG'));
}

function fvgZone(fvg,context,evaluatedAt,source){
 const open=internalFvgOpenAt(context,fvg,evaluatedAt),endTime=open===false?fvgFillChangeAt(context,fvg):evaluatedAt;
 const status=open===null?'unbekannt':open?'offen':'gefüllt';
 return {fvg,zone:{top:fvg.top,bottom:fvg.bottom,startTime:fvg.candleTime,endTime,touched:true},
  label:`${source} ${formatBerlinTime(fvg.candleTime)} · ${status}`};
}

// Strukturquelle und spätere Entryquelle sind getrennt; beide kommen aus dem Produkt, nicht aus einer UI-Auswahl.
export function chartDebuggerReactionZones(entry,context,evaluatedAt){
 if(!entry?.orderBlock)return [];
 const first=entry.reaction?.fvg,next=entry.reaction?.routes?.b?.entryFvg;
 const sources=first?[[first,'Reaktions-FVG']]:[];
 if(next&&next.recognizedAt!==first?.recognizedAt)sources.push([next,'Entry-b-FVG']);
 return sources.filter(([fvg])=>fvg.recognizedAt<=evaluatedAt)
  .map(([fvg,label])=>fvgZone(fvg,context,evaluatedAt,label));
}
