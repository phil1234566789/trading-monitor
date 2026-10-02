import { evaluateChecklistSweeps } from './tradeSetupChecklistSweeps.js';
import { evaluateChecklistTargets } from './tradeSetupChecklistTargets.js';
import { evaluateChecklistConfluences } from './tradeSetupChecklistConfluences.js';
import { evaluateChecklistLifecycle, fixChecklistTargets } from './tradeSetupChecklistLifecycle.js';
import { formatBerlinTime } from './berlinTime.js';
import { hasConfirmedChecklistAbc } from './tradeSetupChecklistGates.js';

export function evaluateChecklistCandidates(context, sessionConfigs = [], { entryGates = false, timeBlocked = false } = {}) {
  const sweeps = evaluateChecklistSweeps({ context, entryGates });
  // Sweep/OB bleiben auch während einer Sperre rekonstruierbar. Erst der teure
  // Rest benötigt bestätigtes ABC; unknown und caution sind keine Zeitsperre.
  if (entryGates && (timeBlocked || !hasConfirmedChecklistAbc({
    h1Trend: { status: context.direction ? 'passed' : 'unknown' }, ...sweeps.checks,
  }))) return { ...sweeps, checks: { ...sweeps.checks,
    targets: { status: 'pending', details: ['Zielprüfung wartet auf bestätigtes ABC und eine Zeit ohne bekannte Sperre.'] } }, targetPreview: null };
  return finalizeChecklistCandidates(sweeps, context, sessionConfigs);
}

export function finalizeChecklistCandidates(sweeps, context, sessionConfigs = []) {
  for (const candidate of sweeps.candidates) {
    candidate.targetSelection = fixChecklistTargets({ candidate, instrument: context.instrument,
      candles: context.m5Candles, sessionConfigs });
    if (candidate.targetSelection?.status !== 'passed') continue;
    candidate.lifecycle = evaluateChecklistLifecycle({ selection: candidate.targetSelection,
      invalidation: candidate.invalidation, candles: context.m5Candles, evaluatedAt: context.evaluatedAt });
    candidate.validity = candidate.lifecycle.main;
  }
  const remaining = sweeps.candidates.filter(c => c.validity.state !== 'ended');
  sweeps.primary = remaining.find(c => c.direction === context.direction) ?? null;
  sweeps.opposingCandidates = remaining.filter(c => c.direction !== context.direction);
  sweeps.checks = sweeps.primary?.checks ?? {
    liquiditySweep: { status: 'pending', details: ['Kein noch unbeendeter Hauptkandidat.'] },
    reaction: { status: 'pending', details: ['Kein Hauptkandidat für die M5-Reaktion.'] },
  };
  const checks = { ...sweeps.checks };
  if (sweeps.primary?.validity.state === 'unknown') {
    checks.liquiditySweep = { ...checks.liquiditySweep, details: [...checks.liquiditySweep.details,
      sweeps.primary.targetSelection?.status === 'passed'
        ? 'Setup-Gültigkeit unbekannt: Kerzenabdeckung seit der Zielauswahl unvollständig.'
        : 'Setup-Gültigkeit offen: Invalidierung und erstes Target sind noch nicht vollständig festgelegt.'] };
  }
  let targetPreview = null;
  if (!sweeps.primary) {
    checks.targets = { status: 'pending', details: ['Zielkandidaten folgen, sobald ein Haupt-Sweep bestimmt ist.'] };
  } else if (sweeps.primary.targetSelection) {
    targetPreview = sweeps.primary.targetSelection;
    checks.targets = { status: targetPreview.status, details: [
      `Ziele fixiert um ${formatBerlinTime(targetPreview.selectedAt)} Uhr`, ...targetPreview.details,
    ] };
  } else {
    targetPreview = evaluateChecklistTargets({ direction: context.direction,
      referencePrice: context.m5Candles.findLast(c => !c.ignored)?.close, evaluatedAt: context.evaluatedAt,
      instrument: context.instrument, m5Candles: context.m5Candles, sessionConfigs });
    checks.targets = { status: 'unknown', details: [
      'Vorläufige Zielkandidaten; feste Auswahl folgt mit der bestätigten C-Reaktion.',
      ...targetPreview.details,
    ] };
  }
  const observations = evaluateChecklistConfluences({ ...context, primary: sweeps.primary,
    opposingCandidates: sweeps.opposingCandidates, target2: sweeps.primary?.targetSelection?.target2 ?? null });
  Object.assign(checks, observations);
  return { ...sweeps, checks, targetPreview };
}
