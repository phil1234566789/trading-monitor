import { DEALING_RANGE_LABELS, dealingRangeLabel } from './tradeSetup2DealingRange.js';
import { DR_OUTCOME_LABELS } from './simulationRunComparison.js';

export function simulationPinStageLabel(context) {
  if (context?.contextVersion === 'simulation-pin-context-v2') return dealingRangeLabel({dealingRange:{version:context.dealingRangeVersion,status:context.stage,reason:context.dealingRangeReason}});
  if (context?.contextVersion) return DEALING_RANGE_LABELS.legacy;
  // Alte Pin-Kontexte enthalten keinen DR-Grund: Preisende und Disqualifikation sind nicht trennbar.
  return context?.stage === 'invalidated' ? 'Historische DR-Entscheidung · Grund nicht gespeichert'
    : DEALING_RANGE_LABELS[context?.stage] ?? 'DR-Stufe nicht gespeichert';
}
export function simulationPinOutcomeLabel(context) {
  if (context?.outcome?.status === 't1Unknown') return 'T1 vor Invalidation · T2 nicht belegt';
  return DR_OUTCOME_LABELS[context?.outcome?.status] ?? context?.outcome?.label ?? 'DR-Ausgang nicht belegt';
}
