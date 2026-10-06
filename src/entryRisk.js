import { toPips, fromPips } from './pipConfig.js';
import { pricePrecisionForInstrument } from './format.js';

export const MAX_FOREX_WIDE_STOP_PIPS = 6;
export const ENTRY_RISK_REASON_LABELS = { wideStopTooLarge: `Weiter SL über ${MAX_FOREX_WIDE_STOP_PIPS} Pips` };

export const formatRiskPips = value => Number.isFinite(value)
  ? value.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : 'unbekannt';

export function entryRiskScale(entry, stop, targets, instrument, direction, { variant, entryPattern } = {}) {
  const sign = direction === 'short' ? -1 : direction === 'long' ? 1 : 0;
  let risk = (entry - stop) * sign;
  if (!sign || !Number.isFinite(entry) || !Number.isFinite(stop) || !(risk > 0)) {
    return { status: 'unknown', entry, stop, risk: null, riskPips: null, levels: [], targets: [] };
  }
  // Der neue Deckel verkürzt nur den weiten Forex-Stopp, ohne den Entry abzulehnen.
  // Historische v8-Snapshots behalten dagegen ihre damalige Ausschlussregel.
  if (entryPattern === 'countertrend-entry-model-1-v9' && variant === 'wide'
    && ['GBPUSD', 'EURUSD'].includes(instrument) && risk > fromPips(MAX_FOREX_WIDE_STOP_PIPS, instrument)) {
    risk = fromPips(MAX_FOREX_WIDE_STOP_PIPS, instrument);
    stop = entry - sign * risk;
  }
  const riskPips = toPips(risk, instrument);
  // Alte Entry-Versionen behalten ihre Stopps. Die Toleranz fängt nur Rundungsfehler
  // beim Subtrahieren der Kurse ab, damit exakt 6 Pips auch für Short zulässig bleiben.
  if (entryPattern === 'countertrend-entry-model-1-v8' && variant === 'wide'
    && ['GBPUSD', 'EURUSD'].includes(instrument) && riskPips > MAX_FOREX_WIDE_STOP_PIPS + 1e-9)
    return { status: 'notExecutable', reason: 'wideStopTooLarge', entry, stop, risk, riskPips, levels: [], targets: [] };
  return { status: 'ready', entry, stop, risk, riskPips,
    levels: [3, 6, 10].map(r => ({ r, price: entry + sign * r * risk })),
    targets: targets.map(target => {
      const reward = (target.price - entry) * sign;
      return { ...target, rr: Number.isFinite(reward) && reward > 0 ? reward / risk : null };
    }) };
}

export function entryRiskSpec(scale, label, styleKey, instrument) {
  if (scale?.status !== 'ready') return null;
  const price = value => value.toLocaleString('de-DE', { minimumFractionDigits: pricePrecisionForInstrument(instrument), maximumFractionDigits: pricePrecisionForInstrument(instrument) });
  return { anchorPrice: scale.entry, axisStyleKey: styleKey, side: 1,
    summary: scale.targets.map(t => `${t.label} ${t.rr == null ? '?' : `${t.rr.toFixed(2).replace('.', ',')}R`}`).join(' · '),
    levels: [
      { price: scale.stop, styleKey, label: `${label} ${price(scale.stop)}` },
      ...scale.levels.map(level => ({ price: level.price, styleKey, label: `${level.r}R` })),
      ...scale.targets.filter(t => t.rr != null).map(t => ({ price: t.price, styleKey,
        label: `${t.label} ${t.rr.toFixed(2).replace('.', ',')}R · ${price(t.price)}` })),
    ] };
}
