import { DEALING_RANGE_LABELS } from './tradeSetup2DealingRange.js';
import { DR_OUTCOME_LABELS } from './simulationRunComparison.js';

export function simulationPinStageLabel(context) {
  // Alte Pin-Kontexte enthalten keinen DR-Grund: Preisende und Disqualifikation sind nicht trennbar.
  return context?.stage === 'invalidated' ? 'Historische DR-Entscheidung · Grund nicht gespeichert'
    : DEALING_RANGE_LABELS[context?.stage] ?? 'DR-Stufe nicht gespeichert';
}
export function simulationPinOutcomeLabel(context) {
  return DR_OUTCOME_LABELS[context?.outcome?.status] ?? context?.outcome?.label ?? 'DR-Ausgang nicht belegt';
}
