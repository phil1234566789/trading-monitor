import { entryRiskScale } from './entryRisk.js';
import { applySimulationCommission } from './tradeSetupSimulationCosts.js';
import { ENTRY_SIZING_VERSION, ENTRY_RISK_BUDGET } from './tradeSetup2EntrySizing.js';

export const SIMULATION_VERSION = 'm5-choch-250-500-whole-lots-half-t1-be-commission-v3';
const money = value => Math.round(value * 1e8) / 1e8;

export function sizeSimulation(entry, variant) {
  const stopPrice = entry.stops?.[variant]?.price;
  // Ohne neue Provenienz behalten alte Snapshots ihr damaliges 500-USD-Modell.
  const sizing = entry.sizing;
  const riskBudget = ENTRY_RISK_BUDGET * (sizing?.factor ?? 1);
  const base = { variant, entryId: entry.id, entryTime: entry.recognizedAt, entryPrice: entry.price,
    stopPrice, riskBudget, entrySizing: sizing ?? null, lots: 0, t1Lots: 0, actualRisk: 0 };
  if (sizing && (sizing.version !== ENTRY_SIZING_VERSION || sizing.model !== 'dr-against-m5-trend'
    || ![0.5, 1].includes(sizing.factor) || sizing.evaluatedAt !== entry.recognizedAt)) {
    return { ...base, status: 'notExecutable', reason: 'invalidSizing' };
  }
  if (!['GBPUSD', 'EURUSD'].includes(entry.instrument)) return { ...base, status: 'notExecutable', reason: 'unsupportedInstrument' };
  const scale = entryRiskScale(entry.price, stopPrice, [], entry.instrument, entry.direction);
  if (scale.status !== 'ready') return { ...base, status: 'notExecutable', reason: 'invalidStop' };
  // Preisarithmetik kann bei exakt ganzen Lots wenige ULP unter dem Quotienten liegen.
  const riskPerLot = money(scale.risk * 100000);
  const lots = Math.floor(riskBudget / riskPerLot + 1e-10);
  if (!(lots >= 1) || !Number.isFinite(lots)) return { ...base, status: 'notExecutable', reason: 'belowOneLot' };
  return { ...base, status: 'ready', reason: null, lots, t1Lots: lots / 2, actualRisk: money(lots * riskPerLot) };
}

export function evaluateSimulation(input) {
  return applySimulationCommission(evaluateGrossSimulation(input));
}

function evaluateGrossSimulation({ entry, variant, candles, evaluatedAt, target1, target2 = null, closedIntervals = [] }) {
  const sizing = sizeSimulation(entry, variant);
  const result = { ...sizing, target1Price: target1, target2Price: target2, status: sizing.status === 'ready' ? 'open' : sizing.status,
    outcome: null, pnlUsd: null, rMultiple: null, realizedPnlUsd: 0, t1PnlUsd: 0, t1Time: null,
    t1RecognizedAt: null, exitTime: null, exitRecognizedAt: null, exitPrice: null, ambiguityRecognizedAt: null, evaluatedAt };
  if (result.status === 'notExecutable') return result;
  const sign = entry.direction === 'long' ? 1 : -1;
  const validTarget = price => Number.isFinite(price) && (price - entry.price) * sign > 0;
  if (!validTarget(target1) || (target2 != null && (!validTarget(target2) || (target2 - target1) * sign <= 0))) {
    return { ...result, status: 'notExecutable', reason: 'invalidTargets' };
  }
  const profit = (price, lots) => money((price - entry.price) * sign * 100000 * lots);
  const finish = (candle, price, outcome, pnl) => ({ ...result, status: 'closed', reason: null, outcome,
    exitTime: candle.time, exitRecognizedAt: candle.time + 60, exitPrice: price,
    pnlUsd: money(pnl), realizedPnlUsd: money(pnl), rMultiple: pnl / result.actualRisk });
  const unknown = (reason, ambiguityRecognizedAt) => ({ ...result, status: 'ambiguous', reason, ambiguityRecognizedAt });
  const closures = closedIntervals.slice().sort((a, b) => a.from - b.from);
  const firstUncovered = (from, to) => {
    let cursor = from;
    for (const range of closures) {
      if (range.from > cursor || cursor >= to) break;
      if (range.to > cursor) cursor = Math.min(range.to, to);
    }
    return cursor;
  };
  const rows = candles.filter(c => c.time >= entry.recognizedAt && c.time + 60 <= evaluatedAt).sort((a, b) => a.time - b.time);
  let expected = entry.recognizedAt;
  for (const c of rows) {
    if (c.time < expected) continue;
    const missing = firstUncovered(expected, c.time);
    if (missing < c.time) return unknown('missingHistory', missing + 60);
    if (![c.low, c.high].every(Number.isFinite) || c.low > c.high) return unknown('missingHistory', c.time + 60);
    expected = c.time + 60;
    const adverse = price => sign === 1 ? c.low <= price : c.high >= price;
    const favorable = price => price != null && (sign === 1 ? c.high >= price : c.low <= price);
    if (result.t1Time == null) {
      const stop = adverse(result.stopPrice);
      const t1 = favorable(target1);
      if (stop && t1) return unknown('sameCandle', c.time + 60);
      if (stop) return finish(c, result.stopPrice, 'slBeforeT1', -result.actualRisk);
      if (!t1) continue;
      // Ohne Intrabar-Reihenfolge könnte BE nach dem Teilverkauf bereits ausgelöst sein.
      result.t1Time = c.time;
      result.t1RecognizedAt = c.time + 60;
      result.realizedPnlUsd = profit(target1, result.t1Lots);
      result.t1PnlUsd = result.realizedPnlUsd;
      if (adverse(entry.price)) return unknown('sameCandle', c.time + 60);
      if (favorable(target2)) return finish(c, target2, 't2', result.realizedPnlUsd + profit(target2, result.t1Lots));
    } else {
      const be = adverse(entry.price);
      const t2 = favorable(target2);
      if (be && t2) return unknown('sameCandle', c.time + 60);
      if (be) return finish(c, entry.price, 't1Be', result.realizedPnlUsd);
      if (t2) return finish(c, target2, 't2', result.realizedPnlUsd + profit(target2, result.t1Lots));
    }
  }
  const missing = firstUncovered(expected, Math.floor(evaluatedAt / 60) * 60);
  if (missing + 60 <= evaluatedAt) return unknown('missingHistory', missing + 60);
  return result;
}
