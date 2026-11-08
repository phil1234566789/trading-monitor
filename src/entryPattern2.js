import {evaluateM1FvgRetestSequence,M1_FVG_RETEST_PATTERN_VERSION} from './m1FvgRetestSequence.js';
import {entryPattern2ConditionsReady} from './entryPattern2Conditions.js';
import {candleTouchesOrderBlock,candleInvalidatesOrderBlock} from './orderBlockDetection.js';
import {m1EntryFromFvg} from './m1Entry.js';
import {normalizeM1ChecklistPresentation} from './m1ChecklistPresentation.js';
import {formatDatedTime} from './berlinTime.js';

export function evaluateEntryPattern2({context,rows,evaluatedAt,pivotBreak,structureStart,trends=[]}) {
  const ob={...context.primary.reactionOB,recognizedAt:context.primary.reactionOB.recognizedAt ?? context.primary.reactionRecognizedAt};
  const start=structureStart?.structureFrom;
  const touch=Number.isFinite(start)?rows.find(c=>!c.ignored&&c.time>=start&&c.time>=ob.recognizedAt
    &&candleTouchesOrderBlock(c,ob)):null;
  const retest=touch?{candleTime:touch.time,recognizedAt:touch.time+60,orderBlock:ob}:null;
  const invalid=rows.some(c=>!c.ignored&&c.time>=start&&c.time>=ob.recognizedAt&&candleInvalidatesOrderBlock(c,ob));
  const sequence=evaluateM1FvgRetestSequence({candles:rows,direction:context.direction,evaluatedAt,
    structureKnownAt:pivotBreak?.recognizedAt,orderBlockRetestKnownAt:retest?.recognizedAt});
  const conditions={m1PivotBreak:pivotBreak,retest,retestedFvg:sequence.zone,fvgRetest:sequence.retest,fvg:sequence.confirmation,
    orderBlockInvalidated:invalid};
  const ready=!invalid&&sequence.status==='ready'&&entryPattern2ConditionsReady(conditions,context.direction,sequence.confirmation?.recognizedAt)
    &&sequence.confirmation.recognizedAt>=(context.validatedAt ?? context.confirmedAt);
  const candidate=ready?m1EntryFromFvg(context,sequence.confirmation,rows,evaluatedAt,retest):null;
  const entry=candidate?{...candidate,entryPattern:M1_FVG_RETEST_PATTERN_VERSION,conditions,
    confirmedAt:context.confirmedAt,entryCategory:'full',positionSizeFactor:1,optionalConditionsMissing:[]}:null;
  const facts=[['M5-OB-Retest',retest],['M1-P2-Pivotbruch',pivotBreak],['M1-FVG zum Retest',sequence.zone],
    ['M1-FVG-Retest',sequence.retest],['Neue M1-FVG-Bestätigung',sequence.confirmation]];
  return normalizeM1ChecklistPresentation({status:entry?'passed':'pending',entryPattern:M1_FVG_RETEST_PATTERN_VERSION,
    instrument:context.instrument,evaluatedAt,trends,structureStart,pivotBreak,retest,
    retestedFvg:sequence.zone,fvgRetest:sequence.retest,fvg:sequence.confirmation,conditions,entry,
    details:[...trends.map(()=>''),...facts.map(([label,fact])=>fact?`${label}: ${formatDatedTime(fact.recognizedAt)} Uhr`:`${label} fehlt`)],
    detailStatuses:[...trends.map(()=>'context'),...facts.map(([,fact])=>fact?'passed':sequence.status==='unknown'?'unknown':'unmet')],
    entryBlockedReason:entry?null:invalid?'M5-Orderblock invalidiert.':sequence.status==='unknown'?'M1-Sequenz nicht vollständig bestimmbar.':null},context.direction);
}
