import { entryPattern1M5BosMatches } from './entryPattern1M5Bos.js';
import {entryPatternVersion} from './entryPattern.js';
import { usesM5BosEntryPattern1, entryPattern1ConditionsReady, isEntryPattern1, usesCountertrendM5BosEntryPattern1, usesOptionalM5BosEntryPattern1, entryPattern1StructureCategory, entryPattern1CategoryMetadata } from './entryPattern1Conditions.js';

export const ENTRY_SIZING_VERSION = 'dr-against-m5-trend-choch-v1';
export const LEGACY_ENTRY_PATTERN_1_SIZING_VERSION = 'countertrend-m5-bos-full-size-v2';
export const ENTRY_PATTERN_1_SIZING_VERSION = 'relative-full-entry-v3';
export const ENTRY_RISK_BUDGET = 500;

export function entryAgainstM5Allowed(checklist, entry) {
  if (isEntryPattern1(entryPatternVersion(entry))) return entry.conditions?.fvg?.recognizedAt === entry.recognizedAt
    && entryPattern1ConditionsReady(entry.conditions,entry.direction,entry.recognizedAt,entryPatternVersion(entry));
  const trend = checklist.checks?.m5Trend?.structureReaction?.trend;
  const opposite = entry.direction === 'long' ? 'downtrend' : 'uptrend';
  return trend !== opposite || entrySizingAt(checklist, entry).reason === 'm5ChochConfirmed';
}

export function entrySizingAt(checklist, entry) {
  if (usesOptionalM5BosEntryPattern1(entryPatternVersion(entry))) {
    const category=checklist.evaluatedAt===entry.recognizedAt && entryAgainstM5Allowed(checklist,entry)
      ? entryPattern1StructureCategory(entry.conditions,entry.direction,entry.recognizedAt,entryPatternVersion(entry)) : null;
    const factor=entryPattern1CategoryMetadata(category)?.positionSizeFactor ?? null;
    return {version:ENTRY_PATTERN_1_SIZING_VERSION,model:'relative-full-entry',evaluatedAt:entry.recognizedAt,
      entryCategory:category,positionSizeFactor:factor,fullFactor:1,factor,
      reason:category==='full'?'m5BosConfirmed':category==='risky'?'m5BosMissing':'invalidConditions',
      bos:category==='full'?{...entry.conditions.m5Bos}:null};
  }
  if (usesM5BosEntryPattern1(entryPatternVersion(entry))) {
    const bos=entry.conditions?.m5Bos;
    const confirmed=checklist.evaluatedAt===entry.recognizedAt
      && (!usesCountertrendM5BosEntryPattern1(entryPatternVersion(entry)) || entryPattern1M5BosMatches(bos,entry.conditions?.m5Countertrend,entry.direction,entry.recognizedAt))
      && bos?.type==='BOS'
      && bos.direction===entry.direction && Number.isFinite(bos.recognizedAt) && bos.recognizedAt<=entry.recognizedAt;
    return {version:LEGACY_ENTRY_PATTERN_1_SIZING_VERSION,model:'dr-against-m5-trend',evaluatedAt:entry.recognizedAt,
      factor:confirmed?1:0.5,reason:confirmed?'m5BosConfirmed':'m5BosMissing',bos:confirmed?{...bos}:null};
  }
  const reaction = isEntryPattern1(entryPatternVersion(entry))
    ? {direction:entry.direction,choch:entry.conditions?.m5Choch} : checklist.checks?.m5Trend?.structureReaction;
  const choch = reaction?.choch;
  const confirmed = checklist.evaluatedAt === entry.recognizedAt && reaction?.direction === entry.direction
    && choch?.direction === entry.direction && choch.type === 'CHoCH'
    && Number.isFinite(choch.recognizedAt) && choch.recognizedAt <= entry.recognizedAt;
  return { version: ENTRY_SIZING_VERSION, model: 'dr-against-m5-trend', evaluatedAt: entry.recognizedAt,
    factor: confirmed ? 1 : 0.5, reason: confirmed ? 'm5ChochConfirmed' : 'm5ChochMissing',
    choch: confirmed ? { ...choch } : null };
}

export function entrySizingLabel(sizing) {
  if (!sizing) return 'Historischer Stand · bisherige Größe unverändert';
  if (sizing.model==='relative-full-entry') return sizing.entryCategory==='full'
    ? 'Full Entry · 100 % der Full-Größe' : sizing.entryCategory==='risky'
      ? 'Risky Entry · 50 % der Full-Größe · M5-BOS optional, nicht bestätigt' : 'Größe nicht ermittelt';
  if (sizing.reason==='m5BosConfirmed') return 'Volle Größe · Faktor 1 · M5-BOS in Traderichtung bestätigt';
  return sizing.factor === 0.5
    ? '½ Größe · Faktor 0,5 · kein bestätigter M5-CHoCH in Traderichtung'
    : 'Volle Größe · Faktor 1 · M5-CHoCH in Traderichtung bestätigt';
}
