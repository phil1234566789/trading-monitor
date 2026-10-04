import { detectOrderBlocks } from './orderBlockDetection.js';
import { orderBlockRecognitionTimes } from './orderBlockRecognitionTime.js';
import { closedChecklistCandles } from './tradeSetupChecklistTimeBasis.js';
import { evaluateChecklistM5 } from './tradeSetupChecklistM5.js';
import { m1EntryFromFvg } from './m1Entry.js';
import { normalizeM1ChecklistPresentation } from './m1ChecklistPresentation.js';
import { formatDatedTime } from './berlinTime.js';
import { entryModel1ConditionsReady, ENTRY_MODEL_1_VERSION } from './entryModel1Conditions.js';
import { advanceEntryModel1Follow } from './entryModel1Progress.js';

// Explizite Startregel: der aus Setup 1.0 übernommene OB zählt auch bei späterem E.
export function setup1OrderBlockIncluded(primary, direction, evaluatedAt) {
  const ob=primary?.reactionOB, recognizedAt=primary?.reactionRecognizedAt;
  return ob?.dir === (direction === 'short' ? -1 : 1) && Number.isFinite(recognizedAt) && recognizedAt <= evaluatedAt
    ? {...ob,recognizedAt,inclusionRule:'setup1OrderBlockIncluded'} : null;
}

export function eligibleEntryModel1OrderBlocks(zones, primary, direction, confirmedAt, evaluatedAt) {
  if (!Number.isFinite(confirmedAt) || confirmedAt > evaluatedAt) return [];
  const original=setup1OrderBlockIncluded(primary,direction,evaluatedAt);
  return [...(original ? [original] : []),...zones.filter(ob => ob.dir === (direction === 'short' ? -1 : 1)
    && ob.recognizedAt >= confirmedAt && ob.recognizedAt <= evaluatedAt
    && ob.startTime !== original?.startTime).map(ob => ({...ob,inclusionRule:'formedSinceDrConfirmation'}))];
}

export function entryModel1RetestFvg(rows, orderBlocks, confirmedAt, direction, evaluatedAt, progress) {
  rows=closedChecklistCandles(rows,'1m',evaluatedAt);
  const empty={status:'unknown',retest:null,fvg:null};
  if (!Number.isFinite(confirmedAt)) return empty;
  return advanceEntryModel1Follow(rows,orderBlocks,confirmedAt,direction,evaluatedAt,progress);
}

export function evaluateCountertrendEntryModel1({context,rows,evaluatedAt,bos,choch,trends,sweepReaction,internalSweeps,closeReactionCache,entryProgress}) {
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
    const zones=detectOrderBlocks(m5,'5m').map(ob => ({...ob,recognizedAt:recognition.get(ob.startTime)}));
    const orderBlocks=eligibleEntryModel1OrderBlocks(zones,context.primary,context.direction,context.confirmedAt,evaluatedAt);
    m5Facts={key,m5Bos,orderBlocks};
    if(entryProgress)entryProgress.m5=m5Facts;
  }
  const {m5Bos,orderBlocks}=m5Facts;
  const follow=entryModel1RetestFvg(rows,orderBlocks,context.confirmedAt,context.direction,evaluatedAt,entryProgress);
  const conditions={m5Bos,m1Choch:sweepReaction?.active ? sweepReaction.choch : null,retest:follow.retest,fvg:follow.fvg};
  const candidate=follow.fvg && follow.fvg.recognizedAt >= (context.validatedAt ?? context.confirmedAt)
    && entryModel1ConditionsReady(conditions,context.direction,follow.fvg.recognizedAt)
    ? m1EntryFromFvg(context,follow.fvg,rows,evaluatedAt,follow.retest) : null;
  const entry=candidate ? {...candidate,entryModel:ENTRY_MODEL_1_VERSION,conditions,confirmedAt:context.confirmedAt} : null;
  const facts=[['M5-BOS in Setup-Richtung',m5Bos],['M1-CHoCH ab Sweep',conditions.m1Choch],
    ['M5-OB-Retest',follow.retest],['M1-FVG nach Retest',follow.fvg]];
  return normalizeM1ChecklistPresentation({status:entry?'passed':'pending',entryModel:ENTRY_MODEL_1_VERSION,instrument:context.instrument,evaluatedAt,
    trends,choch:conditions.m1Choch ?? choch,bos,m5Bos,sweepReaction,internalSweeps,orderBlocks,conditions,retest:follow.retest,fvg:follow.fvg,entry,
    details:[...trends.map(()=>''),...facts.map(([label,fact])=>fact ? `${label}: ${formatDatedTime(fact.recognizedAt)} Uhr${fact.orderBlock
      ? ` · OB ${formatDatedTime(fact.orderBlock.startTime)} Uhr · ${fact.orderBlock.bottom}–${fact.orderBlock.top} · ${fact.orderBlock.inclusionRule==='setup1OrderBlockIncluded' ? 'Startregel: Setup-1.0-OB' : 'ab DR-Bestätigung entstanden'}` : ''}` : `${label} fehlt`)],
    detailStatuses:[...trends.map(()=> 'context'),...facts.map(([,fact])=>fact?'passed':follow.status==='unknown'?'unknown':'unmet')],
    entryBlockedReason:entry ? null : facts.filter(([,fact])=>!fact).map(([label])=>label).join('; ') || 'Signale erst nach der FVG bekannt.'},context.direction);
}
