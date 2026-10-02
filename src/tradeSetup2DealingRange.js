import { hasConfirmedChecklistAbc } from './tradeSetupChecklistGates.js';

export const DEALING_RANGE_VERSION = 'abc-d-targets-eg-observations-v1';
export const DEALING_RANGE_LABELS = {
  unconfirmed: 'Unbestätigte Dealing Range', confirmed: 'Bestätigte Dealing Range · Validierung offen',
  validated: 'Validierte Dealing Range', invalidated: 'Invalidierte Dealing Range',
  legacy: 'Altstand · DR-Stufe nicht gespeichert',
};

export function isVersionedDealingRangeRun(run) {
  const config = run?.configuration;
  return config?.dealingRangeVersion === DEALING_RANGE_VERSION || !!config?.instruments?.length
    && config.instruments.every(instrument => instrument.dealingRangeVersion === DEALING_RANGE_VERSION);
}

export function evaluateDealingRange(checklist, candidate = checklist?.setup?.primary) {
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
  return snapshot?.dealingRange?.version === DEALING_RANGE_VERSION ? snapshot.dealingRange.status : 'legacy';
}
