import { buildMarketStructureState, computeRangesPivots } from './marketStructureAnalysis';
import { buildStructureWithPhases } from './trendPhases.js';
import { createCloseReactionCache } from './m5CloseReactionHistory.js';
import { isCandleAppend } from './candleAppend.js';
import { fmtDateTime } from './format.js';
import { barSecondsFor } from './timeframes.js';

export function createChartStructureCalculator() {
  let previous, history = createCloseReactionCache();
  return input => {
    const { candles, periodOuter, periodInner } = input;
    if (input.kind === 'h1') return buildMarketStructureState(input.pivotsOuter, input.pivotsInner,
      periodOuter, periodInner, candles);
    if (previous && (previous.symbol !== input.symbol || !isCandleAppend(previous.candles, candles)))
      history = createCloseReactionCache();
    previous = input;
    const ready = input.anchor != null && candles.length > 0;
    const pivotsOuter = ready ? computeRangesPivots(candles, periodOuter, input.anchor, fmtDateTime) : null;
    const pivotsInner = ready ? computeRangesPivots(candles, periodInner, input.anchor, fmtDateTime) : null;
    return { ...buildStructureWithPhases(pivotsOuter, pivotsInner, periodOuter, periodInner, candles, barSecondsFor('5m'),
      { closeEvaluation: true, closeReactionCache: history }), pivotsOuter, pivotsInner };
  };
}
