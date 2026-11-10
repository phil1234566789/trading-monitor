import {entryPositionSizeFactor} from './entryCategory.js';
import { entryPattern1M5BosMatches, entryPattern1CountertrendKnown } from './entryPattern1M5Bos.js';
import {entryPattern1SweepAgePassed} from './entryPattern1SweepAge.js';

export const ENTRY_PATTERN_1_VERSION = 'countertrend-entry-model-1-v11';
export const OPTIONAL_M5_BOS_ENTRY_PATTERN_1_VERSION = 'countertrend-entry-model-1-v10';
export const isEntryPattern1 = version => [ENTRY_PATTERN_1_VERSION,OPTIONAL_M5_BOS_ENTRY_PATTERN_1_VERSION,'countertrend-entry-model-1-v9','countertrend-entry-model-1-v8','countertrend-entry-model-1-v7','countertrend-entry-model-1-v6','countertrend-entry-model-1-v5', 'countertrend-entry-model-1-v4', 'countertrend-entry-model-1-v3', 'countertrend-entry-model-1-v2', 'countertrend-entry-model-1-v1'].includes(version);
export const usesM5BosEntryPattern1 = version => [ENTRY_PATTERN_1_VERSION,OPTIONAL_M5_BOS_ENTRY_PATTERN_1_VERSION,'countertrend-entry-model-1-v9','countertrend-entry-model-1-v8','countertrend-entry-model-1-v7','countertrend-entry-model-1-v6','countertrend-entry-model-1-v5', 'countertrend-entry-model-1-v4','countertrend-entry-model-1-v3','countertrend-entry-model-1-v2'].includes(version);
export const usesPivotBreakEntryPattern1 = version => [ENTRY_PATTERN_1_VERSION,OPTIONAL_M5_BOS_ENTRY_PATTERN_1_VERSION,'countertrend-entry-model-1-v9','countertrend-entry-model-1-v8','countertrend-entry-model-1-v7','countertrend-entry-model-1-v6','countertrend-entry-model-1-v5','countertrend-entry-model-1-v4'].includes(version);

export const usesCountertrendM5BosEntryPattern1 = version => [ENTRY_PATTERN_1_VERSION,OPTIONAL_M5_BOS_ENTRY_PATTERN_1_VERSION,'countertrend-entry-model-1-v9','countertrend-entry-model-1-v8','countertrend-entry-model-1-v7','countertrend-entry-model-1-v6','countertrend-entry-model-1-v5'].includes(version);

export function entryPattern1ConditionsReady(conditions, direction, entryAt, version = ENTRY_PATTERN_1_VERSION) {
  return entryPattern1ConditionResults(conditions,direction,entryAt,version).every(rule=>!rule.required||rule.passed);
}

// UI und Entry-Gate verwenden dieselben historischen Einzelprädikate.
export function entryPattern1ConditionResults(conditions, direction, entryAt, version = ENTRY_PATTERN_1_VERSION) {
  const {retest,fvg}=conditions ?? {};
  const legacy=version==='countertrend-entry-model-1-v1';
  const m5Key=legacy?'m5Choch':'m5Bos',m1Key=legacy?'m1Bos':usesPivotBreakEntryPattern1(version)?'m1PivotBreak':'m1Choch';
  const m5=conditions?.[m5Key],m1=conditions?.[m1Key];
  const known=fact=>Number.isFinite(fact?.recognizedAt)&&fact.recognizedAt<=entryAt;
  const same=fact=>known(fact)&&fact.direction===direction;
  const optional=usesOptionalM5BosEntryPattern1(version);
  return [
    ...(Object.hasOwn(conditions ?? {},'sweepAge')?[{key:'sweepAge',required:true,passed:entryPattern1SweepAgePassed(conditions,entryAt)}]:[]),
    {key:'direction',required:true,passed:['short','long'].includes(direction)&&Number.isFinite(entryAt)},
    {key:'m5Countertrend',required:optional||usesCountertrendM5BosEntryPattern1(version),passed:entryPattern1CountertrendKnown(conditions?.m5Countertrend,direction,entryAt)},
    {key:m5Key,required:!optional,passed:same(m5)&&m5.type===(legacy?'CHoCH':'BOS')&&(!usesCountertrendM5BosEntryPattern1(version)||entryPattern1M5BosMatches(m5,conditions?.m5Countertrend,direction,entryAt))},
    {key:m1Key,required:true,passed:same(m1)&&m1.type===(legacy?'BOS':usesPivotBreakEntryPattern1(version)?'pivot-break':'CHoCH')},
    {key:'retest',required:true,passed:known(retest)},
    {key:'retestOrderBlock',required:true,passed:retest?.orderBlock?.dir===(direction==='short'?-1:1)},
    {key:'fvg',required:true,passed:same(fvg)},
    {key:'fvgAfterRetest',required:true,passed:fvg?.recognizedAt>retest?.recognizedAt},
  ];
}

export const usesOptionalM5BosEntryPattern1 = version => version === OPTIONAL_M5_BOS_ENTRY_PATTERN_1_VERSION;
export const usesEntryPattern1Categories = version => version === ENTRY_PATTERN_1_VERSION || usesOptionalM5BosEntryPattern1(version);

export function entryPattern1StructureCategory(conditions, direction, at, version = ENTRY_PATTERN_1_VERSION) {
  if(!entryPattern1SweepAgePassed(conditions,at))return null;
  const pivot=conditions?.m1PivotBreak;
  if (pivot?.type !== 'pivot-break' || pivot.direction !== direction
    || !Number.isFinite(pivot.recognizedAt) || pivot.recognizedAt > at) return null;
  const full=entryPattern1M5BosMatches(conditions?.m5Bos,conditions?.m5Countertrend,direction,at);
  if (full) return 'full';
  return usesOptionalM5BosEntryPattern1(version)
    && entryPattern1CountertrendKnown(conditions?.m5Countertrend,direction,at) ? 'risky' : null;
}

export function entryPattern1CategoryMetadata(category) {
  if(!['full','risky'].includes(category))return null;
  return {entryCategory:category,positionSizeFactor:entryPositionSizeFactor({entryCategory:category}),
    optionalConditionsMissing:category==='risky'?['m5Bos']:[]};
}
