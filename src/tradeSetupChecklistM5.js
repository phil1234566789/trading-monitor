import { buildMarketStructureState, computeRangesPivots, innermostStructureStart } from './marketStructureAnalysis';
import { deriveM5CloseReaction } from './m5CloseReaction.js';
import { buildStructureWithPhases } from './trendPhases.js';
import { formatBerlinTime } from './berlinTime.js';
import { pricePrecisionForInstrument } from './format.js';
import { m1AnchorFromM5 } from './m1Structure.js';

export function unknownChecklistM5() {
  return { status: 'unknown', details: ['M5-Trend unbekannt', 'CHOCH', 'BOS'],
    detailStatuses: ['unknown', 'unknown', 'unknown'] };
}

export function evaluateChecklistOuterM5(context, settings, anchor) {
  const candles = context.m5Candles.filter(c => !c.ignored);
  if (anchor == null || !candles.length || candles[0].time > anchor) return null;
  const outerPeriod = settings.m5StructurePeriod ?? 5, innerPeriod = settings.m5Structure2Period ?? 2;
  const outer = computeRangesPivots(candles, outerPeriod, anchor), inner = computeRangesPivots(candles, innerPeriod, anchor);
  const state = buildMarketStructureState(outer, inner, outerPeriod, innerPeriod, candles, { barSeconds: 300 });
  return { state, outer, inner, outerPeriod, innerPeriod, candles };
}

export function evaluateChecklistM5(context, settings = {}, structureStart, prepared) {
  const result = unknownChecklistM5();
  const candles = context.m5Candles.filter(c => !c.ignored);
  // Die neue A–D-Checkliste übergibt den D1-Anker direkt; der alte Countertrend-Pfad
  // behält seinen bisherigen H1-Nested-Anker.
  const anchor = structureStart ?? innermostStructureStart(context.h1State, context.h1Cutoff);
  if (anchor == null || !candles.length || candles[0].time > anchor) return result;
  const outerPeriod = settings.m5StructurePeriod ?? 5;
  const innerPeriod = settings.m5Structure2Period ?? 2;
  const { state, closeReaction } = prepared ? { state: prepared.state,
    closeReaction: deriveM5CloseReaction(prepared.state, prepared.outer, prepared.inner, prepared.outerPeriod,
      prepared.innerPeriod, prepared.candles, 300, context.closeReactionCache) } : buildStructureWithPhases(
    computeRangesPivots(candles, outerPeriod, anchor), computeRangesPivots(candles, innerPeriod, anchor),
    outerPeriod, innerPeriod, candles, 300, { closeEvaluation: true, closeReactionCache: context.closeReactionCache });
  result.structureReaction = closeReaction;
  result.trend = closeReaction.trend;
  result.structureStart = anchor;
  result.structureState = state;
  result.m1Anchor = m1AnchorFromM5(state, closeReaction, context.direction, context.evaluatedAt);
  if (closeReaction.trend === 'unknown') return result;
  const direction = context.direction;
  const trendDirection = closeReaction.trend === 'uptrend' ? 'long' : 'short';
  const matchingReaction = closeReaction.direction === direction;
  const choch = matchingReaction ? closeReaction.choch : null;
  const bos = matchingReaction ? closeReaction.bos : null;
  const detail = (label, signal) => signal
    ? `${label} ${signal.price.toFixed(pricePrecisionForInstrument(context.instrument))} um ${formatBerlinTime(signal.candleTime)}` : label;
  result.details = [`M5-Trend ${trendDirection === 'long' ? 'bullisch' : 'bärisch'}`, detail('CHOCH', choch), detail('BOS', bos)];
  if (direction) {
    result.detailStatuses = [trendDirection === direction, !!choch, !!bos].map(passed => passed ? 'passed' : 'unmet');
    // H beschreibt nur den Fortschritt in Checklist-Richtung; daraus folgt kein Gesamt-Go.
    result.status = trendDirection === direction || choch || bos ? 'passed' : 'pending';
  }
  return result;
}
