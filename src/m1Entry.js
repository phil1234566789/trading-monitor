import { barSecondsFor } from './timeframes.js';
import { entryRiskScale, formatRiskPips } from './entryRisk.js';
import { formatBerlinTime } from './berlinTime.js';
import { entrySizingLabel } from './tradeSetup2EntrySizing.js';

export function m1EntryFromFvg(context, fvg, candles, evaluatedAt, retest = null) {
  if (!fvg || !context?.setupKey || !Number.isFinite(evaluatedAt)
    || !Number.isFinite(fvg.recognizedAt) || fvg.recognizedAt > evaluatedAt) return null;
  // FVG-Zeit ist der goldene Impuls. Entry gehört zur tatsächlich vorhandenen
  // Bestätigungskerze und wird erst bei deren Schluss bekannt.
  const candle = candles.find(c => c.time + barSecondsFor('1m') === fvg.recognizedAt);
  if (!candle || !Number.isFinite(candle.close) || candle.time <= fvg.candleTime) return null;
  const short = context.direction === 'short';
  const priceField = short ? 'high' : 'low';
  const retestRows = retest ? candles.filter(c => !c.ignored && c.time >= retest.candleTime && c.time <= candle.time) : [];
  // Das Retestextrem ist beim Entry bekannt, auch wenn seine rechten P5-Kerzen
  // noch fehlen. Spätere Hochs/Tiefs dürfen den eingefrorenen Stopp nicht verschieben.
  const extreme = retestRows.reduce((best, c) => !best || (short ? c.high > best.high : c.low < best.low) ? c : best, null);
  const stops = {
    wide: { price: context.primary.reactionOB?.[short ? 'top' : 'bottom'] ?? null, sourceTime: context.primary.reactionOB?.startTime },
    narrow: { price: extreme?.[priceField] ?? null, sourceTime: extreme?.time ?? null },
  };
  const selection = context.primary.targetSelection;
  const targets = selection?.status === 'passed' && selection.selectedAt <= fvg.recognizedAt
    ? ['target1', 'target2'].flatMap((key, i) => selection[key] ? [{ label: `T${i + 1}`, price: selection[key].price }] : []) : [];
  const scales = Object.fromEntries(Object.entries(stops).map(([key, stop]) =>
    [key, entryRiskScale(candle.close, stop.price, targets, context.instrument, context.direction)]));
  return { id: `${context.instrument}:${context.setupKey}:entry-1`, label: 'Entry 1',
    instrument: context.instrument, setupKey: context.setupKey, direction: context.direction,
    candleTime: candle.time, recognizedAt: fvg.recognizedAt, price: candle.close, stops, scales };
}

export function entryChecklist(m1Check) {
  const entry = m1Check?.entry;
  if (!entry) return { status: 'pending', details: [], detailStatuses: [] };
  const distances = entry.scales ? [['wide', 'Weiter SL'], ['narrow', 'Enger SL']].map(([key, label]) => {
    const scale = entry.scales[key];
    return `${label}: ${formatRiskPips(scale.riskPips)}${scale.status === 'ready' ? ' Pips' : ''}`;
  }) : [];
  const label = Number.isFinite(entry.recognizedAt) ? `${entry.label} um ${formatBerlinTime(entry.recognizedAt)} Uhr` : entry.label;
  return { status: 'passed', details: [label, ...(entry.sizing ? [entrySizingLabel(entry.sizing)] : []), ...distances], detailStatuses: ['passed'] };
}
