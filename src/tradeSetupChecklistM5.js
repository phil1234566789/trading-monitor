import { computeRangesPivots, innermostStructureStart } from './marketStructureAnalysis';
import { buildStructureWithPhases } from './trendPhases.js';
import { formatDatedTime } from './berlinTime.js';
import { pricePrecisionForInstrument } from './format.js';

export function unknownChecklistM5() {
  return { status: 'unknown', details: ['M5-Trend unbekannt', 'Change of Character', 'BOS'],
    detailStatuses: ['unknown', 'unknown', 'unknown'] };
}

export function evaluateChecklistM5(context, settings = {}) {
  const result = unknownChecklistM5();
  const candles = context.m5Candles.filter(c => !c.ignored);
  const anchor = innermostStructureStart(context.h1State, context.h1Cutoff);
  if (anchor == null || !candles.length || candles[0].time > anchor) return result;
  const outerPeriod = settings.m5StructurePeriod ?? 5;
  const innerPeriod = settings.m5Structure2Period ?? 2;
  const { closeReaction } = buildStructureWithPhases(
    computeRangesPivots(candles, outerPeriod, anchor), computeRangesPivots(candles, innerPeriod, anchor),
    outerPeriod, innerPeriod, candles, 300, { closeEvaluation: true });
  result.structureReaction = closeReaction;
  if (closeReaction.trend === 'unknown') return result;
  const direction = context.direction;
  const trendDirection = closeReaction.trend === 'uptrend' ? 'long' : 'short';
  const matchingReaction = closeReaction.direction === direction;
  const choch = matchingReaction ? closeReaction.choch : null;
  const bos = matchingReaction ? closeReaction.bos : null;
  const detail = (label, signal) => signal
    ? `${label} · ${signal.price.toFixed(pricePrecisionForInstrument(context.instrument))} · Kerze ${formatDatedTime(signal.candleTime)}` : label;
  result.details = [`M5-Trend ${trendDirection === 'long' ? 'bullisch' : 'bärisch'}`, detail('Change of Character', choch), detail('BOS', bos)];
  if (direction) {
    result.detailStatuses = [trendDirection === direction, !!choch, !!bos].map(passed => passed ? 'passed' : 'unmet');
    // H beschreibt nur den Fortschritt in Checklist-Richtung; daraus folgt kein Gesamt-Go.
    result.status = trendDirection === direction || choch || bos ? 'passed' : 'pending';
  }
  return result;
}
