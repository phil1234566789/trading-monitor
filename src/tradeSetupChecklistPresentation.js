import { computeTrendChain, trendChainLevelDisplay } from './tradeSetupCockpit';
import { formatAge } from './chartTimeUtils.js';
import { pricePrecisionForInstrument } from './format.js';

// Nur Darstellung: Status und Zuordnung stammen weiter aus dem Evaluator.
export function checklistPresentation(state) {
  if (!state) return {};
  const view = {};
  if (state.checks?.confluences) view.confluences = { explanation: state.checks.confluences.explanation };
  if (state.structure && Number.isFinite(state.evaluatedAt)) {
    const chain = computeTrendChain(state.structure, state.evaluatedAt);
    if (chain.length) view.h1Trend = { details: chain.map((level, depth) => {
      const age = trendChainLevelDisplay(level, depth).text;
      const nested = 'Nested '.repeat(depth);
      return `${age} ${nested}${level.trend === 'downtrend' ? 'Downtrend' : 'Uptrend'}`;
    }) };
  }
  const primary = state.setup?.primary;
  const sweep = primary?.sweep;
  if (sweep && Number.isFinite(sweep.level?.price) && Number.isFinite(sweep.ageSeconds)) {
    const price = sweep.level.price.toFixed(pricePrecisionForInstrument(state.instrument));
    const tier = sweep.ageTier === 'major' ? 'Major' : sweep.ageTier === 'medium' ? 'Medium' : 'Minor';
    view.liquiditySweep = {
      details: [`${sweep.timeframe} ${tier} Inducement bei ${price} (${formatAge(sweep.ageSeconds)})`],
      explanation: state.checks?.liquiditySweep?.details?.slice(1).join(' '),
    };
  }
  const preview = primary?.reactionPreview;
  if (preview?.ob && Number.isFinite(preview.ob.top) && Number.isFinite(preview.ob.bottom)) {
    view.reaction = { details: [], orderBlock: preview,
      explanation: state.checks?.reaction?.details?.join(' '),
    };
  }
  return view;
}
