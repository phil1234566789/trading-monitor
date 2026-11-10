import {evaluateM1FvgRetestSequence,M1_FVG_RETEST_PATTERN_VERSION} from './m1FvgRetestSequence.js';
import {entryPattern2ConditionsReady} from './entryPattern2Conditions.js';
import {candleTouchesOrderBlock,candleInvalidatesOrderBlock} from './orderBlockDetection.js';
import {m1EntryFromFvg} from './m1Entry.js';
import {normalizeM1ChecklistPresentation} from './m1ChecklistPresentation.js';
import {formatDatedTime} from './berlinTime.js';
import {entryPattern2OrderBlockPlacement,evaluateEntryPattern2OrderBlockDepth} from './entryPattern2OrderBlock.js';

export function evaluateEntryPattern2({context,rows,evaluatedAt,pivotBreak,structureStart,trends=[]}) {
  const ob={...context.primary.reactionOB,recognizedAt:context.primary.reactionOB.recognizedAt ?? context.primary.reactionRecognizedAt};
  const start=structureStart?.structureFrom;
  const touch=Number.isFinite(start)?rows.find(c=>!c.ignored&&c.time>=start&&c.time>=ob.recognizedAt
    &&candleTouchesOrderBlock(c,ob)):null;
  const retest=touch?{candleTime:touch.time,recognizedAt:touch.time+60,orderBlock:ob}:null;
  const sequence=evaluateM1FvgRetestSequence({candles:rows,direction:context.direction,evaluatedAt,
    structureKnownAt:pivotBreak?.recognizedAt,orderBlockRetestKnownAt:retest?.recognizedAt});
  const checkedThrough=sequence.confirmation?.recognizedAt ?? evaluatedAt;
  const invalid=rows.some(c=>!c.ignored&&c.time>=start&&c.time>=ob.recognizedAt&&c.time+60<=checkedThrough&&candleInvalidatesOrderBlock(c,ob));
  const orderBlockPlacement=entryPattern2OrderBlockPlacement({orderBlock:ob,level:context.primary.sweep?.level,
    direction:context.direction,sourceKnownAt:context.primary.recognizedAt,evaluatedAt:retest?.candleTime ?? evaluatedAt});
  const orderBlockDepth=evaluateEntryPattern2OrderBlockDepth({orderBlock:ob,direction:context.direction,retest,
    candles:rows,entryAt:checkedThrough,evaluatedAt});
  const conditions={m1PivotBreak:pivotBreak,retest,retestedFvg:sequence.zone,fvgRetest:sequence.retest,fvg:sequence.confirmation,
    orderBlockInvalidated:invalid,orderBlockPlacement,orderBlockDepth};
  const ready=!invalid&&sequence.status==='ready'&&entryPattern2ConditionsReady(conditions,context.direction,sequence.confirmation?.recognizedAt)
    &&sequence.confirmation.recognizedAt>=(context.validatedAt ?? context.confirmedAt);
  const candidate=ready?m1EntryFromFvg(context,sequence.confirmation,rows,evaluatedAt,retest):null;
  const entry=candidate?{...candidate,entryPattern:M1_FVG_RETEST_PATTERN_VERSION,conditions,
    confirmedAt:context.confirmedAt,entryCategory:'full',positionSizeFactor:1,optionalConditionsMissing:[]}:null;
  const facts=[['M5-OB-Retest',retest],['M5-OB vollständig jenseits des LS',orderBlockPlacement],
    [`M5-OB bis Entry höchstens ${orderBlockDepth.maxRetestFraction*100} % angetestet`,orderBlockDepth],['M1-P2-Pivotbruch',pivotBreak],['M1-FVG zum Retest',sequence.zone],
    ['M1-FVG-Retest',sequence.retest],['Neue M1-FVG-Bestätigung',sequence.confirmation]];
  return normalizeM1ChecklistPresentation({status:entry?'passed':'pending',entryPattern:M1_FVG_RETEST_PATTERN_VERSION,
    instrument:context.instrument,evaluatedAt,trends,structureStart,pivotBreak,retest,
    retestedFvg:sequence.zone,fvgRetest:sequence.retest,fvg:sequence.confirmation,conditions,entry,
    details:[...trends.map(()=>''),...facts.map(([label,fact])=>Number.isFinite(fact?.recognizedAt)?`${label}: ${formatDatedTime(fact.recognizedAt)} Uhr`:`${label} nicht bekannt`)],
    detailStatuses:[...trends.map(()=>'context'),...facts.map(([,fact])=>fact?.status ?? (fact?'passed':sequence.status==='unknown'?'unknown':'unmet'))],
    entryBlockedReason:entry?null:orderBlockPlacement.status==='unmet'?'M5-Orderblock liegt nicht vollständig jenseits des LS.'
      :orderBlockDepth.status==='unmet'?`M5-Orderblock vor Entry tiefer als ${orderBlockDepth.maxRetestFraction*100} % angetestet.`
      :invalid?'M5-Orderblock invalidiert.':[orderBlockPlacement,orderBlockDepth].some(rule=>rule.status==='unknown')?'M5-OB-Lage oder Retest-Verlauf nicht vollständig bestimmbar.'
      :sequence.status==='unknown'?'M1-Sequenz nicht vollständig bestimmbar.':null},context.direction);
}
