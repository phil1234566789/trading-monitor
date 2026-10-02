export const SIMULATION_COST_VERSION = 'usd5-roundturn-opening-volume-v1';

// Der volle Roundturn wird einmal beim Entry angesetzt. Teilverkäufe lösen
// keine weitere Gebühr aus; dieselbe Ableitung funktioniert für alte Bruttoläufe.
export function applySimulationCommission(result) {
  const notEntered = result.status === 'notExecutable' || result.entryTime > result.evaluatedAt;
  const executed = !notEntered && Number.isFinite(result.lots) && result.lots > 0;
  const commissionUsd = notEntered ? 0 : executed ? result.lots * 5 : null;
  const net = gross => Number.isFinite(gross) && commissionUsd != null ? gross - commissionUsd : null;
  const netPnlUsd = executed && result.status === 'closed' ? net(result.pnlUsd) : null;
  return { ...result, costVersion: SIMULATION_COST_VERSION, commissionUsd, netPnlUsd,
    netRMultiple: netPnlUsd != null && result.actualRisk > 0 ? netPnlUsd / result.actualRisk : null,
    realizedNetPnlUsd: executed ? net(result.realizedPnlUsd) : null };
}
