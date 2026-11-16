import {evaluateDoubleOrderBlockPriceGap} from './doubleOrderBlockPriceGap.js';
import {evaluateDoubleOrderBlockRetestDay} from './doubleOrderBlockRetestDay.js';
import {doubleOrderBlockDisplay} from './doubleOrderBlocks.js';
import {structuralState,reasonText,price,time,range} from './obReactionGraph.js';

// DOB-Ebene des Chart-Debuggers: Paar-Gates in der Reihenfolge von detectDoubleOrderBlocks. Die OB-Reaktion ist hier nur
// ein Gate-Knoten je OB; ihre Details stehen in der Reaktions-Ebene. Ohne erkanntes Paar rechnet der Plan die Gates mit
// denselben Engine-Funktionen nach, weil das Produkt ein gescheitertes Paar nur in stats zählt.
const GATE_STATUS={passed:'visited',rejected:'rejected',failed:'rejected',unknown:'unknown'};
const VARIANT_TEXT={success:'Ziel 2R erreicht',loss:'SL getroffen',ambiguous:'SL und Ziel in einer Kerze',open:'läuft',pending:'wartet',unknown:'unbekannt'};
const GATES=['roles','ob1','ob2','geometry','gap','day','hold'];

function reactionGate(id,role,{orderBlock,reaction}){
 const s=structuralState(reaction),known=s==='true'||s==='false';
 return {id,label:`${role==='first'?'OB1':'OB2'}-Reaktion`,gate:role,
  status:!orderBlock?'not-visited':s==='true'?'visited':s==='false'?'rejected':'unknown',
  sub:!orderBlock?'OB noch nicht bekannt':known?`${s} · ${time(reaction.knownAt)}${reaction.reason?' · '+reasonText(reaction.reason):''}`
   :`unknown${reaction?.reason?' · '+reasonText(reaction.reason):''}`,
  detail:['Details in der Ebene OB-Reaktion (Klick wechselt dorthin).']};
}

export function dobPairGraph({dir,orderBlocks:[first,second],pair,hold,evaluatedAt,instrument='XAUUSD'}){
 const a=first.orderBlock,b=second.orderBlock,ra=first.reaction,rb=second.reaction;
 const aLive=structuralState(ra)==='true',bLive=structuralState(rb)==='true',side=dir===1?'höher':'tiefer';
 const n={};
 n.roles={label:'OB-Rollen: OB1 vor OB2',status:a&&b?(a.startTime<b.startTime?'visited':'rejected'):'unknown',
  sub:[`OB1 ${time(first.startTime)}${a?' · '+range(a):' · noch nicht bekannt'}`,`OB2 ${time(second.startTime)}${b?' · '+range(b):' · noch nicht bekannt'}`].join('\n'),
  detail:['OB1 ist die frühere, OB2 die spätere gleichgerichtete M5-OB des Paars.']};
 n.ob1=reactionGate('ob1','first',first);
 n.ob2=reactionGate('ob2','second',second);
 const deeper=a&&b?(b.top-a.top)*dir>0&&(b.bottom-a.bottom)*dir>0:null;
 const ordered=aLive&&rb?.contact?ra.fvg.recognizedAt<=rb.contact.candleTime:null;
 n.geometry={label:`Geometrie: OB2 ${side} als OB1, OB1-Reaktion vor OB2-Kontakt`,
  status:deeper===false||ordered===false?'rejected':deeper&&ordered?'visited':deeper==null?'not-visited':'unknown',
  sub:[deeper==null?'○ Zonen fehlen':`Oberkante und Unterkante ${side}: ${deeper?'ja':'nein'}`,
   ordered==null?'Reihenfolge ◇ offen':`OB1-Reaktion ${time(ra.fvg.recognizedAt)} ${ordered?'≤':'>'} OB2-Kontakt ${time(rb.contact.candleTime)}`].join('\n'),
  detail:['Beide Kanten von OB2 müssen in Trendrichtung jenseits von OB1 liegen, und die OB1-Reaktion muss vor dem OB2-Kontakt bekannt sein.']};
 const gap=pair?.priceGap??(a&&b?evaluateDoubleOrderBlockPriceGap(a,b,dir,instrument):null);
 n.gap={label:'Preisabstand der Zonen',status:gap?GATE_STATUS[gap.status]:'not-visited',
  sub:gap?`${gap.positiveZoneGap==null?'–':price(gap.positiveZoneGap)} (max. ${gap.maximum==null?'–':price(gap.maximum)}) · ${gap.status}`:'○ Zonen fehlen',
  detail:['Lücke zwischen OB1 und OB2; über dem Instrument-Maximum kein Paar.']};
 const day=ra?.contact&&rb?.contact?evaluateDoubleOrderBlockRetestDay(ra.contact.candleTime,rb.contact.candleTime):null;
 n.day={label:'Beide Retests am selben Berliner Tag',status:day?GATE_STATUS[day.status]:'not-visited',
  sub:day?`${day.status}${day.reason?' · '+day.reason:''}`:'○ wartet auf beide Kontakte',detail:['Berliner Kalendertag der beiden Retest-Kontakte.']};
 const sweep=hold?.breakCandle;
 n.hold={label:'OB1-Hold: Retest-Extrem hält bis OB2-Reaktion?',status:hold?GATE_STATUS[hold.status]==='visited'&&!hold.final?'unknown':GATE_STATUS[hold.status]:'not-visited',
  sub:!hold?'○ wartet auf OB1-Reaktion':hold.status==='failed'?`gebrochen ${time(hold.firstSweepTime)} @ ${price(dir===1?sweep.low:sweep.high)}`
   :hold.final?`hält · ${hold.status}`:'hält bisher · wartet auf OB2-Reaktion',
  detail:hold?[`Anker ${price(hold.anchor.price)} ab ${time(hold.anchor.fromTime)} (${hold.anchor.kind==='exact'?'exakter Retest':'Reaktion'}).`,
   `Prüfzeitraum ${time(hold.checkedFrom)}–${time(hold.checkedThrough)}.`]:['Hold beginnt mit der OB1-Reaktion.']};
 // Routen, SL, Entry-Fenster und Outcome gibt es nur am erkannten Paar (pairEntries); ohne Paar wären OB2-Routen kein DOB-Trade.
 const entries=Object.entries(pair?.entries??{}),ready=entries.filter(([,e])=>e.status==='ready'),display=doubleOrderBlockDisplay(pair,evaluatedAt);
 const noPair=pair?null:'○ kein Paar';
 const chosen=ready[0]?.[1];
 n.stop={label:'SL-Regel',status:chosen?'visited':pair?'unknown':'not-visited',
  sub:noPair??(chosen?`${chosen.stopAnchor==='m5-edge'?'interne FVG offen → ferne M5-Kante':'keine offen → Retest-Extrem'} · ${price(chosen.stopPrice)}`:'◇ noch kein Entry'),
  detail:['Interne M1-FVG beim Entry offen → ferne M5-Kante, sonst Retest-Extrem ohne Puffer.']};
 n.routes={label:'Entry-Routen a / b',status:ready.length?'visited':pair?'unknown':'not-visited',
  sub:noPair??entries.map(([k,e])=>`${k}: ${e.status==='ready'?`Entry ${time(e.entryTime)} @ ${price(e.entryPrice)}`:`${e.status}${e.reason?' · '+reasonText(e.reason):''}`}`).join('\n'),
  detail:['Routen von OB2 aus pairEntries; nach Entry a bleibt b skipped.']};
 const outside=entries.some(([,e])=>e.reason==='outsideEntryWindow');
 n.window={label:'Entry-Fenster 02:00–22:00 Berlin',status:outside?'rejected':ready.length?'visited':pair?'unknown':'not-visited',
  sub:noPair??(outside?'Entry außerhalb → abgelehnt':ready.length?`Entry ${time(chosen.entryTime)} im Fenster`:'◇ noch kein Entry'),detail:['Entries nur 02:00–22:00 Berlin, sonst outsideEntryWindow.']};
 n.outcome={label:'Outcome 2R',status:!ready.length?'not-visited':ready.some(([k])=>display.variants[k]==='loss')?'rejected':ready.every(([k])=>display.variants[k]==='success')?'visited':'unknown',
  sub:noPair??(ready.length?ready.map(([k,e])=>`${k}: Ziel ${price(e.targetPrice)} · ${VARIANT_TEXT[display.variants[k]]??display.variants[k]}`).join('\n'):'○ kein Entry'),
  detail:['Ziel = Entry ± 2 × Risiko; Ergebnis aus evaluateDoubleOrderBlockOutcome zum Sliderstand.']};
 const failed=GATES.find(id=>n[id].status==='rejected'),allPassed=GATES.every(id=>n[id].status==='visited');
 n.result={label:'Ergebnis',status:pair?'visited':failed?'rejected':'unknown',
  sub:pair?`DOB erkannt ${time(pair.recognizedAt)}`:failed?`kein DOB · ${n[failed].label}`:allPassed?'kein DOB · Grund nicht belegt (Partnerwahl oder kein Entry)':'◇ offen',
  detail:['DOB = detectDoubleOrderBlocks liefert dieses Paar zum Sliderstand.']};
 return {title:`detectDoubleOrderBlocks() · ${dir===1?'Long':'Short'} · OB1 ${time(first.startTime)} → OB2 ${time(second.startTime)}`,
  nodes:Object.entries(n).map(([id,node])=>({id,...node}))};
}

// Sprungziele der DOB-Ebene: Wissenszeitpunkte beider OBs, Hold-Bruch, Paar, Entries und Outcomes.
export function dobChangeTimes({orderBlocks,pair,hold}){
 const times=orderBlocks.flatMap(({orderBlock,reaction})=>[orderBlock?.recognizedAt,reaction?.contact?.knownAt,reaction?.knownAt]);
 times.push(hold?.firstSweepKnownAt,pair?.recognizedAt);
 for(const e of Object.values(pair?.entries??{}))times.push(e.entryTime,e.knownAt,e.outcome?.recognizedAt);
 return [...new Set(times.filter(Number.isFinite))].sort((x,y)=>x-y);
}
