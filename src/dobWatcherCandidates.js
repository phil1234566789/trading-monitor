import {berlinDateStrFor,formatBerlinTime} from './berlinTime.js';
import {dobPoiLine,dobTpLine,dobWarnText} from './dobAlarm.js';
import {dobBlockKey,dobBlockStatsText} from './dobBlockStats.js';
import {poiMaxDistanceAtr} from './dobHtfObPoi.js';
import {dobTs11Label} from './dobPoiLabel.js';

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
 if(s.phase==='win'||s.phase==='loss')return s.phase;
 if(s.phase==='entry'&&s.entryTime>=evaluatedAt-DOB_ENTRY_FRESH_SECONDS)return 'entry';
 return 'running';
}
const num=v=>v.toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1});
// Warum ein DOB verworfen ist, konkret statt „kein POI in Reichweite“ neben einer genannten Zone (Philip): HTF-OB mit Abstand und
// Grenze des Instruments, LQ-Sweep mit dem nächsten TS1.1 und wie weit es von der Kante weg ist.
function droppedText(s,poiType,instrument){
 if(!['noPoi','missingTradeSetups'].includes(s.reason))return 'ohne POI-Daten';
 if(poiType==='lq_sweep')return `kein TS1.1-OB mit gleicher Kante${s.poi?.kind==='ts11'?` · nächstes ${dobTs11Label({...s.poi,instrument})}`:''}`;
 const max=poiMaxDistanceAtr(instrument);
 if(!s.poi)return 'keine retestete H1/H4-Zone (Zone nicht retestet)';
 return `nächste ${s.poi.timeframe}-Zone ${num(s.poi.distanceAtr)} ATR weg, erlaubt ≤ ${num(max)} ATR`;
}
// Rahmen fürs aufgeklappte Detail (ChecklistOrderBlock): OB1, OB2 und bei LQ-Sweep das TS1.1-OB, wenn es nicht exakt OB1/OB2 ist.
function obFrames(s){
 const dir=s.direction==='long'?1:-1,word=dir===1?'bullische':'bärische',c=s.chart;
 const frame=(name,zone,start)=>({label:`${name} · ${word} M5 OB (${formatBerlinTime(start)})`,ob:{dir,top:zone.top,bottom:zone.bottom,startTime:start}});
 const frames=[frame('OB1',c.firstOrderBlock,c.firstOrderBlockStart),frame('OB2',c.secondOrderBlock,c.secondOrderBlockStart)];
 const ts=s.poi?.kind==='ts11'?s.poi:null;
 if(ts?.zone&&Number.isFinite(ts.zoneStartTime)&&ts.matchedEdge!=='both')frames.push({...frame(`TS1.1-OB #${ts.tradeSetupId}`,ts.zone,ts.zoneStartTime)});
 return frames;
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
   const setup={...s,instrument};
   // Verworfen: nur der Grund (mit Zone bzw. TS1.1), damit keine POI-Zeile neben „kein POI“ steht.
   const parts=status==='dropped'?[droppedText(s,poiType,instrument)]:[dobPoiLine(setup,poiType).replace(/^POI: /,'')];
   if(status==='blocked')parts.push(`${dobWarnText(s.reason,guardrails,s.entryTime??s.phaseSince)}${guardrails?dobBlockStatsText(blockStats,dobBlockKey(guardrails,s.reason,s.entryTime??s.phaseSince)):''}`);
   if(s.entryTime!=null&&status!=='blocked'&&status!=='dropped'){const tp=dobTpLine(setup,guardrails);if(tp)parts.push(tp);}
   rows.set(key,{key,ob2,instrument,poiType,pairId:s.pairId,direction:s.direction,status,blockLabel:BLOCK_LABEL[s.reason]??null,
    time:status==='win'||status==='loss'?s.phaseSince:time,poi:poiShort(s,poiType),detail:parts.join(' · '),
    tradeSetupId:s.poi?.kind==='ts11'?s.poi.tradeSetupId:null,chartAt:time+60,frames:obFrames(s)});
  }
 }
 const carried=new Set([...rows.values()].filter(r=>r.status!=='dropped').map(r=>r.ob2)),dropped=new Set();
 return [...rows.values()].filter(r=>r.status!=='dropped'||(!carried.has(r.ob2)&&!dropped.has(r.ob2)&&dropped.add(r.ob2)))
  .sort((a,b)=>b.time-a.time);
}
