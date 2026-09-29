import { toPips } from './pipConfig.js';
import { pricePrecisionForInstrument } from './format.js';

export const formatRiskPips = value => Number.isFinite(value)
  ? value.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : 'unbekannt';

export function entryRiskScale(entry, stop, targets, instrument, direction) {
  const sign = direction === 'short' ? -1 : direction === 'long' ? 1 : 0;
  const risk = (entry - stop) * sign;
  if (!sign || !Number.isFinite(entry) || !Number.isFinite(stop) || !(risk > 0)) {
    return { status: 'unknown', entry, stop, risk: null, riskPips: null, levels: [], targets: [] };
  }
  return { status: 'ready', entry, stop, risk, riskPips: toPips(risk, instrument),
    levels: [3, 4, 5, 6].map(r => ({ r, price: entry + sign * r * risk })),
    targets: targets.map(target => {
      const reward = (target.price - entry) * sign;
      return { ...target, rr: Number.isFinite(reward) && reward > 0 ? reward / risk : null };
    }) };
}

export function entryRiskSpec(scale, label, styleKey, instrument) {
  if (scale.status !== 'ready') return null;
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
