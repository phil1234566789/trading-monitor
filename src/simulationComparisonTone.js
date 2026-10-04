export function comparisonTone(current, previous, lowerIsBetter = false) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || current === previous) return '';
  return ((current > previous) !== lowerIsBetter) ? 'positive' : 'worse';
}
