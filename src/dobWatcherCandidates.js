import {berlinDateStrFor,formatBerlinTime} from './berlinTime.js';
import {dobPoiLine,dobPrice,dobTpLine,dobWarnText} from './dobAlarm.js';
import {DOB_DEFAULT_TP_R} from './dobGuardrails.js';
import {dobBlockKey,dobBlockStatsText} from './dobBlockStats.js';
import {poiMaxDistanceAtr} from './dobHtfObPoi.js';
import {dobLsReactionLabel} from './dobPoiLabel.js';

// Heutige DOB-Kandidaten eines Watcher-Laufs für das DOB-Watcher-Panel (Dashboard): der Watcher schreibt sie je Instrument nach
// dob_watcher_state.candidates, die Seite zeigt sie nur an. Frühe OB1-Phasen bleiben draußen (Philip), unklar zählt als „läuft“.
// Status: retest (Retest + wartet auf Entry), entry (frischer Entry), running, win, loss, blocked (Konfig-Sperre), dropped.
export const DOB_ENTRY_FRESH_SECONDS=15*60;
const BLOCK_LABEL={blockedEntryHour:'Sperrzeit',blockedMonth:'Monat',blockedZoneAge:'Zonenalter',counterDob:'Gegen-DOB',counterCandles:'Gegenkerzen'};
const PHASES=new Set(['ob2Retest','ob2Recognized','entry','win','loss','ambiguous','unknown']);
const RANK={dropped:0,blocked:1,retest:2,entry:3,running:3,win:4,loss:4};

function statusOf(s,evaluatedAt){
 if(s.reason)return BLOCK_LABEL[s.reason]?'blocked':'dropped';
 if(s.phase==='ob2Retest'||s.phase==='ob2Recognized')return 'retest';
 // Teilprofit: TP1 getroffen und Rest zu (Entry, TP2 oder SL) = Win, egal wie der Ausgang ohne Teilprofit stünde.
 if(s.partialOutcome&&['breakeven','success','loss'].includes(s.partialOutcome.rest.status))return 'win';
 if(s.phase==='win'||s.phase==='loss')return s.phase;
 if(s.phase==='entry'&&s.entryTime>=evaluatedAt-DOB_ENTRY_FRESH_SECONDS)return 'entry';
 return 'running';
}
const num=v=>v.toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1});
// Warum ein DOB verworfen ist, konkret statt „kein POI in Reichweite“ neben einer genannten Zone (Philip): HTF-OB mit Abstand und
// Grenze des Instruments, LQ-Sweep mit dem nächsten LS-Reaktion und wie weit es von der Kante weg ist.
function droppedText(s,poiType,instrument){
 if(!['noPoi','missingTradeSetups'].includes(s.reason))return 'ohne POI-Daten';
 if(poiType==='lq_sweep')return `kein LS-Reaktion-OB mit gleicher Kante${s.poi?.kind==='ts11'?` · nächstes ${dobLsReactionLabel({...s.poi,instrument})}`:''}`;
 const max=poiMaxDistanceAtr(instrument);
 if(!s.poi)return 'keine retestete H1/H4-Zone (Zone nicht retestet)';
 return `nächste ${s.poi.timeframe}-Zone ${num(s.poi.distanceAtr)} ATR weg, erlaubt ≤ ${num(max)} ATR`;
}
// Rahmen fürs aufgeklappte Detail (ChecklistOrderBlock): bei HTF-OB zuerst die POI-Zone (auch die zu weite bei verworfen, Philip),
// dann OB1, OB2 und bei LQ-Sweep das LS-Reaktion-OB mit LS-Preis, wenn es nicht exakt OB1/OB2 ist. Zonen von Vortagen mit Datum.
function obFrames(s,instrument){
 const dir=s.direction==='long'?1:-1,word=dir===1?'bullische':'bärische',c=s.chart,day=berlinDateStrFor(c.secondOrderBlockStart);
 const when=t=>{const d=berlinDateStrFor(t);return d===day?formatBerlinTime(t):`${d.slice(8,10)}.${d.slice(5,7)}. ${formatBerlinTime(t)}`;};
 const box=(label,zone,start)=>({label,ob:{dir,top:zone.top,bottom:zone.bottom,startTime:start}});
 const frame=(name,zone,start)=>box(`${name} · ${word} M5 OB (${when(start)})`,zone,start);
 const htf=s.poi?.zone&&s.poi.kind!=='ts11'&&s.poi.timeframe&&Number.isFinite(s.poi.zoneStartTime)?s.poi:null;
 const frames=[...(htf?[box(`POI · ${htf.timeframe}-OB (${when(htf.zoneStartTime)})`,htf.zone,htf.zoneStartTime)]:[]),
  frame('OB1',c.firstOrderBlock,c.firstOrderBlockStart),frame('OB2',c.secondOrderBlock,c.secondOrderBlockStart)];
 const ts=s.poi?.kind==='ts11'?s.poi:null;
 if(ts?.zone&&Number.isFinite(ts.zoneStartTime)&&ts.matchedEdge!=='both')
  frames.push(frame(`LS-Reaktion-OB #${ts.tradeSetupId}${Number.isFinite(ts.lsPrice)?` · LS ${dobPrice(ts.lsPrice,instrument)}`:''}`,ts.zone,ts.zoneStartTime));
 return frames;
}
// Status-Satz vorn im Detail (Philip): Status und Grund im Klartext, Preise im Format des Instruments, Zeiten in Berlin.
const rText=k=>`${k.toLocaleString('de-DE')}R`;
function partialText(p,px){
 const rest=p.rest.status==='breakeven'?`Rest SL auf Entry um ${formatBerlinTime(p.rest.at)}`
  :p.rest.status==='success'?`TP2 ${rText(p.tpR)} @ ${px(p.rest.price)} um ${formatBerlinTime(p.rest.at)}`:`Rest SL @ ${px(p.rest.price)} um ${formatBerlinTime(p.rest.at)}`;
 return `Win: TP1 ${rText(p.atR)} @ ${px(p.tp1.price)} um ${formatBerlinTime(p.tp1.at)}, ${rest}`;
}
function statusHead(s,status,{instrument,poiType,guardrails,blockStats}){
 const px=v=>dobPrice(v,instrument),setup={...s,instrument};
 const levels=()=>[`SL ${px(s.stopPrice)}`,(dobTpLine(setup,guardrails)??'').replaceAll(' @ ',' ')].filter(Boolean).join(' · ');
 switch(status){
  case 'dropped':return `verworfen, weil: ${droppedText(s,poiType,instrument)}`;
  case 'blocked':{
   const at=s.entryTime??s.phaseSince,why=dobWarnText(s.reason,guardrails,at).replace(/^Entry in /,'').replace(/, Entry$/,'');
   const stats=guardrails?dobBlockStatsText(blockStats,dobBlockKey(guardrails,s.reason,at)).replace(/^ · /,'').replace(/ \((.+)\)$/,', $1'):'';
   return `gesperrt, weil: ${why}${stats?` (${stats})`:''}`;
  }
  case 'retest':return `OB2 berührt um ${formatBerlinTime(s.recognizedAt??s.phaseSince)}, Entry noch offen`;
  case 'entry':return `Entry ${s.route} @ ${px(s.entryPrice)} um ${formatBerlinTime(s.entryTime)} · ${levels()}`;
  case 'running':return `läuft seit ${formatBerlinTime(s.entryTime)} · ${levels()}`;
  case 'loss':return `Loss: SL getroffen @ ${px(s.outcome?.exitPrice)} um ${formatBerlinTime(s.outcome?.recognizedAt??s.phaseSince)}`;
  default:return s.partialOutcome?partialText(s.partialOutcome,px)
   :`Win: TP ${rText(s.tpRule?.tpR??DOB_DEFAULT_TP_R)} getroffen @ ${px(s.outcome?.exitPrice)} um ${formatBerlinTime(s.outcome?.recognizedAt??s.phaseSince)}`;
 }
}
const poiShort=(s,poiType)=>poiType==='lq_sweep'?'LQ-Sweep':s.poi?.timeframe?`${s.poi.timeframe}-OB`:'HTF-OB';

// runs: Ergebnis von dobPoiTypeAlarmRuns (je POI-Art result, guardrails, blockStats). Eine Zeile je POI-Art, Richtung und OB2 (wie die
// Alarm-Dedup: mehrere OB1-Partner teilen sich OB2), die weiteste Phase gewinnt; „verworfen“ nur, wenn keine andere POI-Art es trägt.
export function dobWatcherCandidates(runs,evaluatedAt,instrument){
 const today=berlinDateStrFor(evaluatedAt),rows=new Map();
 for(const {poiType,result,guardrails,blockStats} of runs){
  for(const s of [...result.setups,...result.rejected]){
   if(!PHASES.has(s.phase))continue;
   const time=s.entryTime??s.phaseSince;
   if(!Number.isFinite(time)||berlinDateStrFor(s.phaseSince)!==today)continue;
   const status=statusOf(s,evaluatedAt),ob2=`${instrument}:${s.direction}:${s.chart.secondOrderBlockStart}`,key=`${poiType}:${ob2}`,old=rows.get(key);
   if(old&&RANK[old.status]>=RANK[status])continue;
   const head=statusHead(s,status,{instrument,poiType,guardrails,blockStats});
   // Verworfen: der Grund nennt Zone bzw. LS-Reaktion schon, keine POI-Zeile neben „kein POI“.
   const poiText=status==='dropped'?null:dobPoiLine({...s,instrument},poiType).replace(/^POI: /,'POI ');
   rows.set(key,{key,ob2,instrument,poiType,pairId:s.pairId,direction:s.direction,status,blockLabel:BLOCK_LABEL[s.reason]??null,
    time:status==='win'||status==='loss'?s.phaseSince:time,poi:poiShort(s,poiType),head,poiText,detail:[head,poiText].filter(Boolean).join(' · '),
    tradeSetupId:s.poi?.kind==='ts11'?s.poi.tradeSetupId:null,chartAt:time+60,frames:obFrames(s,instrument)});
  }
 }
 const carried=new Set([...rows.values()].filter(r=>r.status!=='dropped').map(r=>r.ob2)),dropped=new Set();
 return [...rows.values()].filter(r=>r.status!=='dropped'||(!carried.has(r.ob2)&&!dropped.has(r.ob2)&&dropped.add(r.ob2)))
  .sort((a,b)=>b.time-a.time);
}
