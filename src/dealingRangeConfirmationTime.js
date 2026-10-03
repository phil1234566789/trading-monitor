import { evaluateDealingRange } from './tradeSetup2DealingRange.js';

// E kann später als Setup 1.0 bekannt werden; OBs beginnen deshalb an der DR-Bestätigung.
export function dealingRangeConfirmedAt(checklist, candidate = checklist.setup?.primary) {
  if (evaluateDealingRange(checklist,candidate).status === 'unconfirmed') return null;
  const times=[candidate?.reactionRecognizedAt,candidate?.targetSelection?.selectedAt,
    candidate?.checks?.outerM5Trend?.evaluatedAt,candidate?.checks?.m5Trend?.evaluatedAt].filter(Number.isFinite);
  return times.length ? Math.max(...times) : null;
}
