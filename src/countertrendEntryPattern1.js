import { detectOrderBlocks } from './orderBlockDetection.js';
import { createIncrementalOrderBlockDetector } from './incrementalOrderBlocks.js';
import { orderBlockRecognitionTimes } from './orderBlockRecognitionTime.js';
import { closedChecklistCandles } from './tradeSetupChecklistTimeBasis.js';
import { evaluateChecklistM5 } from './tradeSetupChecklistM5.js';
import { m1EntryFromFvg } from './m1Entry.js';
import { normalizeM1ChecklistPresentation } from './m1ChecklistPresentation.js';
import { formatDatedTime } from './berlinTime.js';
import { entryPattern1ConditionsReady, ENTRY_PATTERN_1_VERSION } from './entryPattern1Conditions.js';
import { advanceEntryPattern1Follow } from './entryPattern1Progress.js';

// Explizite Startregel: der aus Setup 1.0 übernommene OB zählt auch bei späterem E.
export function setup1OrderBlockIncluded(primary, direction, evaluatedAt) {
  const ob=primary?.reactionOB, recognizedAt=primary?.reactionRecognizedAt;
  return ob?.dir === (direction === 'short' ? -1 : 1) && Number.isFinite(recognizedAt) && recognizedAt <= evaluatedAt
    ? {...ob,recognizedAt,inclusionRule:'setup1OrderBlockIncluded'} : null;
}

export function eligibleEntryPattern1OrderBlocks(zones, primary, direction, confirmedAt, evaluatedAt) {
  if (!Number.isFinite(confirmedAt) || confirmedAt > evaluatedAt) return [];
  const original=setup1OrderBlockIncluded(primary,direction,evaluatedAt);
  return [...(original ? [original] : []),...zones.filter(ob => ob.dir === (direction === 'short' ? -1 : 1)
    && ob.recognizedAt >= confirmedAt && ob.recognizedAt <= evaluatedAt
    && ob.startTime !== original?.startTime).map(ob => ({...ob,inclusionRule:'formedSinceDrConfirmation'}))];
}

export function entryPattern1RetestFvg(rows, orderBlocks, confirmedAt, direction, evaluatedAt, progress) {
  rows=closedChecklistCandles(rows,'1m',evaluatedAt);
  const empty={status:'unknown',retest:null,fvg:null};
  if (!Number.isFinite(confirmedAt)) return empty;
  return advanceEntryPattern1Follow(rows,orderBlocks,confirmedAt,direction,evaluatedAt,progress);
}

export function evaluateCountertrendEntryPattern1({context,rows,evaluatedAt,trends,pivotBreak,structureStart,internalSweeps,closeReactionCache,entryProgress}) {
  const m5=closedChecklistCandles(context.m5Candles,'5m',evaluatedAt);
  const key=JSON.stringify([context.instrument,context.direction,context.structureStart,context.settings,
    context.confirmedAt,context.primary?.reactionOB,m5[0]?.time,m5.at(-1)?.time,m5.length]);
  let m5Facts=entryProgress?.m5?.key===key ? entryProgress.m5 : null;
  if(!m5Facts){
    const current=evaluateChecklistM5({instrument:context.instrument,direction:context.direction,evaluatedAt,
      m5Candles:m5,closeReactionCache},context.settings,context.structureStart);
    const reaction=current.structureReaction;
    const m5Bos=(reaction?.levels ?? []).find(s => s.type === 'BOS' && s.direction === context.direction
      && Number.isFinite(s.recognizedAt) && s.recognizedAt <= evaluatedAt) ?? null;
    const recognition=orderBlockRecognitionTimes(m5,'5m');
    // Der Fortschritt gehört zu diesem Scan/Entry-Kontext, kein globaler Historiencache.
    if(entryProgress)entryProgress.detectM5OrderBlocks??=createIncrementalOrderBlockDetector('5m');
    const zones=(entryProgress?entryProgress.detectM5OrderBlocks(m5):detectOrderBlocks(m5,'5m'))
      .map(ob => ({...ob,recognizedAt:recognition.get(ob.startTime)}));
    const orderBlocks=eligibleEntryPattern1OrderBlocks(zones,context.primary,context.direction,context.confirmedAt,evaluatedAt);
    m5Facts={key,m5Bos,orderBlocks};
    if(entryProgress)entryProgress.m5=m5Facts;
  }
  const {m5Bos,orderBlocks}=m5Facts;
  const follow=entryPattern1RetestFvg(rows,orderBlocks,context.confirmedAt,context.direction,evaluatedAt,entryProgress);
  const conditions={m5Bos,m1PivotBreak:pivotBreak ?? null,retest:follow.retest,fvg:follow.fvg};
  const candidate=follow.fvg && follow.fvg.recognizedAt >= (context.validatedAt ?? context.confirmedAt)
    && entryPattern1ConditionsReady(conditions,context.direction,follow.fvg.recognizedAt)
    ? m1EntryFromFvg(context,follow.fvg,rows,evaluatedAt,follow.retest) : null;
  const entry=candidate ? {...candidate,entryPattern:ENTRY_PATTERN_1_VERSION,conditions,confirmedAt:context.confirmedAt} : null;
  const facts=[['M5-BOS in Setup-Richtung',m5Bos],['M1-Pivotbruch ab Sweep',conditions.m1PivotBreak],
    ['M5-OB-Retest',follow.retest],['M1-FVG nach Retest',follow.fvg]];
  return normalizeM1ChecklistPresentation({status:entry?'passed':'pending',entryPattern:ENTRY_PATTERN_1_VERSION,instrument:context.instrument,evaluatedAt,
    trends,m5Bos,pivotBreak:conditions.m1PivotBreak,structureStart,internalSweeps,orderBlocks,conditions,retest:follow.retest,fvg:follow.fvg,entry,
    details:[...trends.map(()=>''),...facts.map(([label,fact])=>fact ? `${label}: ${formatDatedTime(fact.recognizedAt)} Uhr${fact.orderBlock
      ? ` · OB ${formatDatedTime(fact.orderBlock.startTime)} Uhr · ${fact.orderBlock.bottom}–${fact.orderBlock.top} · ${fact.orderBlock.inclusionRule==='setup1OrderBlockIncluded' ? 'Startregel: Setup-1.0-OB' : 'ab DR-Bestätigung entstanden'}` : ''}` : `${label} fehlt`)],
    detailStatuses:[...trends.map(()=> 'context'),...facts.map(([,fact])=>fact?'passed':follow.status==='unknown'?'unknown':'unmet')],
    entryBlockedReason:entry ? null : facts.filter(([,fact])=>!fact).map(([label])=>label).join('; ') || 'Signale erst nach der FVG bekannt.'},context.direction);
}
