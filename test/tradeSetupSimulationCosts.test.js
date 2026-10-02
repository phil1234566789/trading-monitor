import { expect, it } from 'vitest';
import { applySimulationCommission, SIMULATION_COST_VERSION } from '../src/tradeSetupSimulationCosts.js';
import { evaluateSimulation } from '../src/tradeSetupSimulation.js';
import { simulationAsOf } from '../src/tradeSetupSimulationRepository.js';
import { simulationStatistics } from '../src/tradeSetupSimulationStatistics.js';

const entry = { id: 'e', instrument: 'GBPUSD', direction: 'long', price: 1.35, recognizedAt: 120,
  stops: { wide: { price: 1.3494 }, narrow: { price: 1.34967 } } };
const candles = [{ time: 120, low: 1.3501, high: 1.3511 }, { time: 180, low: 1.3499, high: 1.3511 }];
const evaluate = variant => evaluateSimulation({ entry, variant, candles, evaluatedAt: 240, target1: 1.351, target2: 1.352 });

it('charges five dollars once on whole opening lots across both half exits', () => {
  expect(evaluate('wide')).toMatchObject({ lots: 8, actualRisk: 480, pnlUsd: 400, commissionUsd: 40, netPnlUsd: 360, costVersion: SIMULATION_COST_VERSION });
  expect(evaluate('narrow')).toMatchObject({ lots: 15, t1Lots: 7.5, actualRisk: 495, pnlUsd: 750, commissionUsd: 75, netPnlUsd: 675 });
});
it('keeps entry commission while removing future partial and final profit', () => {
  const result = evaluate('wide');
  expect(simulationAsOf(result, 119)).toBeNull();
  expect(simulationAsOf(result, 120)).toMatchObject({ commissionUsd: 40, netPnlUsd: null, netRMultiple: null, realizedNetPnlUsd: -40 });
  expect(simulationAsOf(result, 180)).toMatchObject({ status: 'open', netPnlUsd: null, realizedNetPnlUsd: 360 });
  expect(simulationAsOf(result, 240)).toMatchObject({ status: 'closed', netPnlUsd: 360 });
});
it('costs are asset-independent, idempotent and do not rewrite old gross results', () => {
  const old = { instrument: 'XAUUSD', lots: 8, status: 'closed', pnlUsd: 400, realizedPnlUsd: 400, actualRisk: 480 };
  const costs = applySimulationCommission(old);
  expect(costs).toMatchObject({ commissionUsd: 40, netPnlUsd: 360 });
  expect(applySimulationCommission(costs)).toEqual(costs);
  expect(old).not.toHaveProperty('costVersion');
  expect(applySimulationCommission({ ...old, status: 'notExecutable' })).toMatchObject({ commissionUsd: 0, netPnlUsd: null });
});
it('uses the selected profit basis and excludes open or ambiguous positions', () => {
  const smallWin = applySimulationCommission({ ...evaluate('wide'), pnlUsd: 20, rMultiple: 20 / 480 });
  expect(simulationStatistics([smallWin], 'wide', 'gross')).toMatchObject({ wins: 1, losses: 0, pnlUsd: 20 });
  expect(simulationStatistics([smallWin], 'wide', 'net')).toMatchObject({ wins: 0, losses: 1, pnlUsd: -20 });
  expect(simulationStatistics([{ ...smallWin, status: 'ambiguous' }], 'wide', 'net').closed).toBe(0);
});
it('does not turn missing outcomes or volume into a known net result', () => {
  expect(applySimulationCommission({ status: 'closed', lots: 8, actualRisk: 480 }))
    .toMatchObject({ commissionUsd: 40, netPnlUsd: null, netRMultiple: null, realizedNetPnlUsd: null });
  expect(applySimulationCommission({ status: 'closed', pnlUsd: 400, actualRisk: 480 }))
    .toMatchObject({ commissionUsd: null, netPnlUsd: null });
  expect(applySimulationCommission({ ...evaluate('wide'), evaluatedAt: 119 }))
    .toMatchObject({ commissionUsd: 0, netPnlUsd: null });
});
