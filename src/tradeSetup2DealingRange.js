import { hasConfirmedChecklistAbc } from './tradeSetupChecklistGates.js';
import { evaluateCountertrendDealingRange, COUNTERTREND_STAGE_VERSION } from './countertrendDealingRange.js';
export { COUNTERTREND_STAGE_VERSION } from './countertrendDealingRange.js';

export const DEALING_RANGE_VERSION = 'abc-d-targets-eg-observations-v1';
export const COUNTERTREND_VERSION = 'countertrend-abcd-v1';
const knownVersion = version => [DEALING_RANGE_VERSION, COUNTERTREND_VERSION, COUNTERTREND_STAGE_VERSION].includes(version);
export const DEALING_RANGE_LABELS = {
  unconfirmed: 'Unbestätigte Dealing Range', confirmed: 'Bestätigte Dealing Range · Validierung offen',
  validated: 'Validierte Dealing Range', invalidated: 'Invalidierte Dealing Range',
  legacy: 'Altstand · DR-Stufe nicht gespeichert',
};

export function isVersionedDealingRangeRun(run) {
  const config = run?.configuration;
  return knownVersion(config?.dealingRangeVersion) || !!config?.instruments?.length
    && config.instruments.every(instrument => knownVersion(instrument.dealingRangeVersion));
}

export function evaluateDealingRange(checklist, candidate = checklist?.setup?.primary) {
  if (checklist?.model === 'countertrend') {
    if (checklist.ruleVersion !== COUNTERTREND_VERSION) return evaluateCountertrendDealingRange(checklist, candidate);
    const confirmed = checklist.status === 'ready' && candidate?.setupType === 'countertrend'
      && hasConfirmedChecklistAbc(candidate.checks) && candidate.checks.m5Trend?.status === 'passed';
    // Validierung/Invalidierung der neuen Strategie sind noch nicht festgelegt.
    // Vorhandene Targets bleiben Beobachtungen und erfinden keine neue DR-Stufe.
    return { version: COUNTERTREND_VERSION, model: 'countertrend', evaluatedAt: checklist.evaluatedAt,
      status: confirmed ? 'confirmed' : 'unconfirmed', reason: confirmed ? 'validationOpen' : candidate?.abortReason ?? 'abcIncomplete',
      details: [confirmed ? 'A bis D erfüllt; Validierung offen.' : candidate?.abortReason ?? 'A bis D noch nicht vollständig erfüllt.'], eShowstoppers: [] };
  }
  const at = checklist?.evaluatedAt;
  const checks = { h1Trend: checklist?.checks?.h1Trend, ...candidate?.checks };
  const confirmed = checklist?.status === 'ready' && Number.isFinite(at)
    && candidate?.direction === checklist.direction && hasConfirmedChecklistAbc(checks)
    && Number.isFinite(candidate.reactionRecognizedAt) && candidate.reactionRecognizedAt <= at;
  const result = { version: DEALING_RANGE_VERSION, model: 'dr-against-m5-trend', evaluatedAt: at,
    status: 'unconfirmed', reason: 'abcIncomplete', details: ['A, B und C sind noch nicht vollständig bestätigt.'],
    eShowstoppers: [] };
  if (!confirmed) return result;
  const selection = candidate.targetSelection;
  const known = Number.isFinite(selection?.selectedAt) && selection.selectedAt <= at;
  if (known && selection.status === 'passed' && Number.isFinite(selection.target1?.price)
    && (!Number.isFinite(selection.target1.knownAt) || selection.target1.knownAt <= selection.selectedAt)) {
    return { ...result, status: 'validated', reason: 'targetsAvailable', details: ['ABC bestätigt; D erfüllt. E enthält aktuell keine Showstopper.'] };
  }
  // „pending“ aus der erfolgten Zielsuche heißt: kein zulässiger Pivot gefunden.
  // Ein bloß offener Checklistpunkt ohne Auswahl belegt dagegen kein Scheitern.
  if (known && ['pending', 'unmet'].includes(selection.status)) {
    return { ...result, status: 'invalidated', reason: 'targetsUnavailable', details: selection.details ?? ['Keine zulässigen Targets bestimmbar.'] };
  }
  return { ...result, status: 'confirmed', reason: 'targetsUnchecked',
    details: selection?.details ?? ['Zielprüfung noch offen oder Daten unvollständig.'] };
}

// Altstände bleiben unklassifiziert; eine Anzeige darf keinen historischen Lauf umdeuten.
export function savedDealingRangeStatus(snapshot) {
  return knownVersion(snapshot?.dealingRange?.version) ? snapshot.dealingRange.status : 'legacy';
}
