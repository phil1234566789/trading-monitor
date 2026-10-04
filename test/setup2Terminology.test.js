import { describe, it, expect } from 'vitest';
import { dealingRangeLabel, savedDealingRangeStatus, COUNTERTREND_STAGE_VERSION } from '../src/tradeSetup2DealingRange.js';
import { simulationPinStageLabel, simulationPinOutcomeLabel } from '../src/simulationPinPresentation.js';

describe('saved DR terminology', () => {
  it('separates a historical price end from disqualification without changing saved values', () => {
    for (const reason of ['priceInvalidation', 'h1CounterDivergence', 'antiConfluence', 'targetsUnavailable']) {
      const snapshot = { dealingRange: { version: COUNTERTREND_STAGE_VERSION, status: 'invalidated', reason } };
      const before = JSON.stringify(snapshot);
      expect(dealingRangeLabel(snapshot)).toBe(reason === 'priceInvalidation'
        ? 'DR beendet · Invalidierungslevel erreicht' : 'Disqualifizierte Dealing Range');
      expect(savedDealingRangeStatus(snapshot)).toBe('invalidated');
      expect(JSON.stringify(snapshot)).toBe(before);
    }
    expect(dealingRangeLabel({ dealingRange: { status: 'invalidated' } })).toBe('Altstand · DR-Stufe nicht gespeichert');
  });
  it('renders old pin outcomes from their status and leaves an ambiguous historical stage unclassified', () => {
    const context = { stage: 'invalidated', outcome: { status: 'invalidation', label: 'Lief in die Invalidierung' } };
    const before = JSON.stringify(context);
    expect(simulationPinOutcomeLabel(context)).toBe('Invalidation vor T1');
    expect(simulationPinStageLabel(context)).toBe('Historische DR-Entscheidung · Grund nicht gespeichert');
    expect(JSON.stringify(context)).toBe(before);
    expect(simulationPinOutcomeLabel({ outcome: { status: 't1Unknown' } })).toBe('T1 vor Invalidation · T2 nicht belegt');
  });
});
