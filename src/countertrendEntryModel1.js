import { detectOrderBlocks, candleTouchesOrderBlock } from './orderBlockDetection.js';
import { orderBlockRecognitionTimes } from './orderBlockRecognitionTime.js';
import { closedChecklistCandles } from './tradeSetupChecklistTimeBasis.js';
import { evaluateChecklistM5 } from './tradeSetupChecklistM5.js';
import { m1EntryFromFvg } from './m1Entry.js';
import { normalizeM1ChecklistPresentation } from './m1ChecklistPresentation.js';
import { formatDatedTime } from './berlinTime.js';
import { entryModel1ConditionsReady, ENTRY_MODEL_1_VERSION } from './entryModel1Conditions.js';

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

export function entryModel1RetestFvg(rows, orderBlocks, confirmedAt, direction, evaluatedAt) {
  rows=closedChecklistCandles(rows,'1m',evaluatedAt);
  const empty={status:'unknown',retest:null,fvg:null};
  if (!Number.isFinite(confirmedAt)) return empty;
  const start=Math.ceil(confirmedAt/60)*60, after=rows.filter(c => c.time >= start);
  if (after.some((c,i) => c.time !== start+i*60) || start+after.length*60 < Math.floor(evaluatedAt/60)*60) return empty;
  const retests=orderBlocks.flatMap(ob => {
    const touch=after.find(c => !c.ignored && c.time >= ob.recognizedAt && candleTouchesOrderBlock(c,ob));
    return touch ? [{candleTime:touch.time,recognizedAt:touch.time+60,orderBlock:ob}] : [];
  }).sort((a,b) => a.recognizedAt-b.recognizedAt || a.orderBlock.startTime-b.orderBlock.startTime);
  const recognition=orderBlockRecognitionTimes(rows,'1m');
  const fvgs=detectOrderBlocks(rows,'1m').filter(z => z.dir === (direction === 'short' ? -1 : 1))
    .map(z => ({direction,candleTime:z.startTime,recognizedAt:recognition.get(z.startTime),gap:z.fvg}))
    .filter(f => f.recognizedAt <= evaluatedAt).reverse();
  for (const fvg of fvgs) {
    const retest=retests.find(r => r.recognizedAt < fvg.recognizedAt);
    if (retest) return {status:'ready',retest,fvg};
  }
  return {...empty,status:'ready',retest:retests.at(-1) ?? null};
}

export function evaluateCountertrendEntryModel1({context,rows,evaluatedAt,bos,choch,trends,internalSweeps,closeReactionCache}) {
  const m5=closedChecklistCandles(context.m5Candles,'5m',evaluatedAt);
  const current=evaluateChecklistM5({instrument:context.instrument,direction:context.direction,evaluatedAt,
    m5Candles:m5,closeReactionCache},context.settings,context.structureStart);
  const reaction=current.structureReaction;
  const m5Choch=(reaction?.levels ?? []).find(s => s.type === 'CHoCH' && s.direction === context.direction
    && Number.isFinite(s.recognizedAt) && s.recognizedAt <= evaluatedAt) ?? null;
  const recognition=orderBlockRecognitionTimes(m5,'5m');
  const zones=detectOrderBlocks(m5,'5m').map(ob => ({...ob,recognizedAt:recognition.get(ob.startTime)}));
  const orderBlocks=eligibleEntryModel1OrderBlocks(zones,context.primary,context.direction,context.confirmedAt,evaluatedAt);
  const follow=entryModel1RetestFvg(rows,orderBlocks,context.confirmedAt,context.direction,evaluatedAt);
  const conditions={m5Choch,m1Bos:bos,retest:follow.retest,fvg:follow.fvg};
  const candidate=follow.fvg && follow.fvg.recognizedAt >= (context.validatedAt ?? context.confirmedAt)
    && entryModel1ConditionsReady(conditions,context.direction,follow.fvg.recognizedAt)
    ? m1EntryFromFvg(context,follow.fvg,rows,evaluatedAt,follow.retest) : null;
  const entry=candidate ? {...candidate,entryModel:ENTRY_MODEL_1_VERSION,conditions,confirmedAt:context.confirmedAt} : null;
  const facts=[['M5-CHoCH in Setup-Richtung',m5Choch],['M1-BOS in Setup-Richtung',bos],
    ['M5-OB-Retest',follow.retest],['M1-FVG nach Retest',follow.fvg]];
  return normalizeM1ChecklistPresentation({status:entry?'passed':'pending',entryModel:ENTRY_MODEL_1_VERSION,evaluatedAt,
    trends,choch,bos,m5Choch,internalSweeps,orderBlocks,conditions,retest:follow.retest,fvg:follow.fvg,entry,
    details:[...trends.map(()=>''),...facts.map(([label,fact])=>fact ? `${label}: ${formatDatedTime(fact.recognizedAt)} Uhr${fact.orderBlock
      ? ` · OB ${formatDatedTime(fact.orderBlock.startTime)} Uhr · ${fact.orderBlock.bottom}–${fact.orderBlock.top} · ${fact.orderBlock.inclusionRule==='setup1OrderBlockIncluded' ? 'Startregel: Setup-1.0-OB' : 'ab DR-Bestätigung entstanden'}` : ''}` : `${label} fehlt`)],
    detailStatuses:[...trends.map(()=> 'context'),...facts.map(([,fact])=>fact?'passed':follow.status==='unknown'?'unknown':'unmet')],
    entryBlockedReason:entry ? null : facts.filter(([,fact])=>!fact).map(([label])=>label).join('; ') || 'Signale erst nach der FVG bekannt.'},context.direction);
}
