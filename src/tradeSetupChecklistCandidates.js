import { evaluateChecklistSweeps } from './tradeSetupChecklistSweeps.js';
import { evaluateChecklistTargets } from './tradeSetupChecklistTargets.js';
import { evaluateChecklistConfluences } from './tradeSetupChecklistConfluences.js';

// Eine aktuelle Zielsuche ist nützliche Information, aber noch keine historisch
// fixierte Auswahl. Ohne deren Fachregel darf sie kein vergangenes Setup verlängern.
export function evaluateChecklistCandidates(context, sessionConfigs = []) {
  const sweeps = evaluateChecklistSweeps({ context });
  const checks = { ...sweeps.checks };
  if (sweeps.primary?.validity.state === 'unknown') {
    checks.liquiditySweep = { ...checks.liquiditySweep, details: [...checks.liquiditySweep.details,
      'Setup-Gültigkeit offen: Invalidierung und erstes Target sind noch nicht vollständig festgelegt.'] };
  }
  let targetPreview = null;
  if (!sweeps.primary) {
    checks.targets = { status: 'pending', details: ['Zielkandidaten folgen, sobald ein Haupt-Sweep bestimmt ist.'] };
  } else {
    targetPreview = evaluateChecklistTargets({ direction: context.direction,
      referencePrice: context.m5Candles.findLast(c => !c.ignored)?.close, evaluatedAt: context.evaluatedAt,
      instrument: context.instrument, m5Candles: context.m5Candles, sessionConfigs });
    checks.targets = { status: 'unknown', details: [
      'Vorläufige Zielkandidaten am Bewertungsstand; Zeitpunkt und Referenz der festen Setup-Zielauswahl sind noch offen.',
      ...targetPreview.details,
    ] };
  }
  const observations = evaluateChecklistConfluences({ ...context, primary: sweeps.primary,
    opposingCandidates: sweeps.opposingCandidates, target2: null });
  Object.assign(checks, observations);
  return { ...sweeps, checks, targetPreview };
}
