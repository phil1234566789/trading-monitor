import {berlinDateStrFor,berlinDayRangeUtcMs,formatBerlinTime,formatDatedTime} from './berlinTime.js';
import {fmtPrice,pricePrecisionForInstrument} from './format.js';

const isM5Ob=item=>item.kind==='ob'&&item.timeframe==='5M'&&Number.isFinite(item.sourceTime);

// Ohne Entry-Zeit im Formular verankert die jüngste M5-OB-Evidence den Tag; beide Retests liegen laut Indikator am selben Berliner Tag.
export function dobAnchorTime(trade) {
  if(Number.isFinite(trade?.entryTime))return trade.entryTime;
  const times=(trade?.confirmations??[]).filter(isM5Ob).map(item=>item.sourceTime);
  return times.length?Math.max(...times):null;
}

// Auswertung bis Ende des Berliner Tags (oder jetzt): später bekannte Entries anderer Tage spielen keine Rolle.
export function dobEvaluationTime(anchorTime,nowSec) {
  return Math.min(nowSec,berlinDayRangeUtcMs(berlinDateStrFor(anchorTime)).endUtcMs/1000);
}

function statsReason(stats) {
  const second=stats.reactions.second;
  return `Indikator: ${stats.orderBlocks} M5-OBs · OB-Reaktionen true ${second.true} / false ${second.false} / unknown ${second.unknown}`+
    ` · Paare ohne Entry ${stats.pairsWithoutEntry} · OB1-Hold verworfen ${stats.firstHoldRejected} (unknown ${stats.firstHoldUnknown})`+
    ` · Preislücke ${stats.priceGapRejected} · verschiedene Retest-Tage ${stats.differentRetestDays}.`;
}

// Liefert je fertiger Route (a/b) einen Vorschlag; Vorauswahl nur bei eindeutig bester Übereinstimmung mit der M5-OB-Evidence.
export function dobEntrySuggestions(result,{direction,anchorTime,evidence=[],instrument}) {
  const day=berlinDateStrFor(anchorTime),dirLabel=direction==='short'?'Short':'Long';
  if(result.status!=='ready')return {choices:[],preselectedKey:null,reason:'DOB-Indikator: M5-/M1-Daten unvollständig.'};
  const evidenceTimes=new Set(evidence.filter(isM5Ob).map(item=>item.sourceTime));
  const pairs=result.pairs.filter(pair=>pair.direction===direction&&berlinDateStrFor(pair.recognizedAt)===day);
  const price=value=>fmtPrice(value,pricePrecisionForInstrument(instrument));
  const obs=pair=>`OB1 ${formatBerlinTime(pair.firstOrderBlock.startTime)} / OB2 ${formatBerlinTime(pair.secondOrderBlock.startTime)}`;
  const choices=pairs.flatMap(pair=>{
    const matches=[pair.firstOrderBlock,pair.secondOrderBlock].filter(ob=>evidenceTimes.has(ob.startTime)).length;
    return Object.values(pair.entries).filter(entry=>entry.status==='ready').map(entry=>({
      key:`${pair.id}:${entry.variant}`,pair,variant:entry.variant,evidenceMatches:matches,
      entryPrice:entry.entryPrice,entryTime:entry.entryTime,stopLoss:entry.stopPrice,
      label:`Route ${entry.variant} · ${obs(pair)} · Entry ${price(entry.entryPrice)} @ ${formatDatedTime(entry.entryTime)} · SL ${price(entry.stopPrice)}`+
        (matches?` · ★ M5-OB-Evidence ${matches}/2`:''),
    }));
  }).sort((a,b)=>b.evidenceMatches-a.evidenceMatches||a.entryTime-b.entryTime);
  if(!choices.length){
    const routes=pairs.flatMap(pair=>Object.values(pair.entries).map(entry=>`${obs(pair)} Route ${entry.variant}: ${entry.status}${entry.reason?` (${entry.reason})`:''}`));
    return {choices,preselectedKey:null,reason:routes.length?`Kein fertiger DOB-Entry ${dirLabel} am ${day}. ${routes.join(' · ')}.`:
      `Kein DOB-Paar ${dirLabel} am ${day} (Entries nur 02:00–22:00 Berlin). ${statsReason(result.stats)}`};
  }
  const best=choices[0].evidenceMatches;
  const unique=best>0&&choices.filter(choice=>choice.evidenceMatches===best).length===1;
  return {choices,preselectedKey:unique?choices[0].key:null,
    reason:unique?'':best>0?'Mehrere Vorschläge passen gleich gut zur M5-OB-Evidence. Bitte wählen.':'Kein Vorschlag passt zur M5-OB-Evidence der Dealing Range. Bitte wählen.'};
}
