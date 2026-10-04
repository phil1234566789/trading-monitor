import { DR_PRICE_OBSERVATION_VERSION } from './dealingRangePriceObservation.js';

export const DR_OUTCOME_LABELS = {
  t2: 'T1 vor Invalidation, dann T2', t1Only: 'T1 vor Invalidation, danach zurück ohne T2',
  t1Open: 'T1 vor Invalidation, offen', noTarget2: 'T1 vor Invalidation, kein T2 vorhanden',
  invalidation: 'Invalidation vor T1', open: 'Offen oder uneindeutig',
  unknown: 'DR-Ausgang nicht belegt',
};

export function savedDealingRangePriceOutcome(group) {
  const first = group.firstValidated;
  const observation = [group.latestCandidate, group.snapshot, ...group.entries]
    .map(s => s?.priceObservation).find(o => o?.version === DR_PRICE_OBSERVATION_VERSION
      && o.setupKey === first?.setupKey && o.validatedAt === first?.knownAt);
  if (!observation) return { status: 'unknown', label: DR_OUTCOME_LABELS.unknown };
  const status = observation.stage1 === 'target1'
    ? ({ target2: 't2', returned: 't1Only', open: 't1Open', noTarget2: 'noTarget2', ambiguous: 'open' }[observation.stage2] ?? 'unknown')
    : ({ invalidation: 'invalidation', open: 'open', ambiguous: 'open' }[observation.stage1] ?? 'unknown');
  return { ...observation, status, label: DR_OUTCOME_LABELS[status], from: observation.validatedAt,
    through: observation.rawThrough, recognizedAt: ['windowEnd','missingHistory'].includes(observation.endReason) ? null : observation.endAt };
}
