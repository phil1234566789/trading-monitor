import { collectNestedChain } from './marketStructureAnalysis';
import { deriveM5CloseReaction } from './m5CloseReaction.js';
import { closedChecklistCandles } from './tradeSetupChecklistTimeBasis.js';
import { M1_STRUCTURE_PERIOD } from './m1Structure.js';
import { formatDatedTime, formatBerlinTime } from './berlinTime.js';
import { m1RetestAfterReaction } from './m1Retest.js';
import { m1EntryFromFvg } from './m1Entry.js';
import { latestStructureSweeps } from './structureSweeps.js';
import { pricePrecisionForInstrument } from './format.js';

const waiting = {
  abc: 'M1-Struktur wartet auf A, B und C.',
  anchor: 'M1-Struktur wartet auf einen eindeutigen M5-Anker.',
  loading: 'M1-Kerzen werden geladen.',
  missing: 'M1-Kerzendaten fehlen am Bewertungsstand.',
  structure: 'M1-P5-Struktur noch nicht bestimmbar.',
  error: 'M1-Kerzen konnten nicht geladen werden.',
  disabled: 'M1-Struktur ist ausgeschaltet.',
  ended: 'M1-Auswertung beendet: Target 1 oder Invalidierung erreicht.',
  prerequisites: 'M1 wartet auf vollständige H1-/M5-Prüfdaten.',
};

export function inactiveM1Checklist(reason) {
  return { status: ['abc', 'disabled', 'ended'].includes(reason) ? 'pending' : 'unknown',
    reason, details: [waiting[reason] ?? waiting.prerequisites], detailStatuses: [], evaluatedAt: null };
}

export function evaluateM1Checklist({ context, structure, candles, evaluatedAt }) {
  const unavailable = reason => ({ ...inactiveM1Checklist(reason), evaluatedAt });
  if (structure?.status !== 'ready') return unavailable(structure?.status === 'missing' ? 'missing' : 'loading');
  if (!structure.state || structure.state.trend === 'unknown') return unavailable('structure');
  const rows = closedChecklistCandles(candles, '1m', evaluatedAt);
  const trends = collectNestedChain(structure.state).map((level, depth) => ({ trend: level.trend, depth }));
  const reaction = deriveM5CloseReaction(structure.state, structure.pivotsOuter, [],
    M1_STRUCTURE_PERIOD, M1_STRUCTURE_PERIOD, rows.filter(c => !c.ignored), 60);
  // Die Gegenreaktion einer tieferen Ebene ersetzt nicht die gültigen Signale des Parents.
  const signals = reaction.levels.filter(level => level.direction === context.direction && level.recognizedAt != null);
  const choch = signals.find(level => level.type === 'CHoCH') ?? null;
  const bos = signals.find(level => level.type === 'BOS') ?? null;
  const short = context.direction === 'short';
  const adjective = short ? 'bärischer' : 'bullischer';
  const details = trends.map(({ trend, depth }) => `${depth ? 'Nested '.repeat(depth) : 'M1 '}${trend === 'uptrend' ? 'Uptrend' : 'Downtrend'}`);
  const detailStatuses = trends.map(({ trend }) => (trend === 'downtrend') === short ? 'passed' : 'unmet');
  for (const [label, signal] of [['CHoCH', choch], ['BOS', bos]]) {
    details.push(signal ? `${adjective} ${label} um ${formatBerlinTime(signal.candleTime)}` : `Kein ${adjective} ${label}`);
    detailStatuses.push(signal ? 'passed' : 'unmet');
  }
  const follow = m1RetestAfterReaction(rows, context.primary, evaluatedAt);
  const labels = [short ? 'Bärischer M5-OB-Retest' : 'Bullischer M5-OB-Retest', short ? 'M1 bärische FVG nach Retest' : 'M1 bullische FVG nach Retest'];
  for (const [index, signal] of [follow.retest, follow.fvg].entries()) {
    details.push(signal ? (index === 0 ? `${labels[index]} um ${formatBerlinTime(signal.candleTime)}` : `${labels[index]} · Kerze ${formatDatedTime(signal.candleTime)}`) : labels[index]);
    detailStatuses.push(follow.status === 'unknown' ? 'unknown' : signal ? 'passed' : 'unmet');
  }
  const internalSweeps = latestStructureSweeps(structure.state, evaluatedAt, 60);
  for (const sweep of internalSweeps) {
    details.push(`M1 interner LQ Sweep ${sweep.price.toFixed(pricePrecisionForInstrument(context.instrument))} um ${formatBerlinTime(sweep.candleTime)}`);
    detailStatuses.push('passed');
  }
  return { status: 'pending', details, detailStatuses, evaluatedAt, trends, choch, bos, internalSweeps,
    retest: follow.retest, fvg: follow.fvg, entry: m1EntryFromFvg(context, follow.fvg, rows, evaluatedAt, follow.retest) };
}
