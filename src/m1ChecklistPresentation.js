const trendLabel = trend => trend === 'uptrend' ? 'Uptrend' : 'Downtrend';

// trends ist die gespeicherte collectNestedChain: nur bestätigte, noch aktive Ebenen.
// Die letzte Ebene bestimmt wie in trendPhases die Richtung; Parents sind Kontext.
export function normalizeM1ChecklistPresentation(check, direction, knownAt = check?.evaluatedAt) {
  if (!Array.isArray(check?.trends) || !check.trends.length || !Number.isFinite(check.evaluatedAt)
    || !Number.isFinite(knownAt) || check.evaluatedAt > knownAt) return check;
  const trends = check.trends;
  if (trends.some((level, index) => !level || level.depth !== index
    || !['uptrend', 'downtrend'].includes(level.trend))) return check;
  const currentTrend = trends.at(-1);
  const matches = currentTrend.trend === (direction === 'short' ? 'downtrend' : 'uptrend');
  return { ...check, currentTrend: { ...currentTrend },
    details: [`Aktuelle M1-Richtung: ${trendLabel(currentTrend.trend)}`,
      ...trends.slice(0, -1).map(level => `${level.depth ? `Nested Ebene ${level.depth}` : 'Outer'}: ${trendLabel(level.trend)} (Kontext)`),
      ...(Array.isArray(check.details) ? check.details : []).slice(trends.length)],
    detailStatuses: [check.entryModel ? 'context' : ['long', 'short'].includes(direction) ? matches ? 'passed' : 'unmet' : 'unknown',
      ...trends.slice(0, -1).map(() => 'context'), ...(Array.isArray(check.detailStatuses) ? check.detailStatuses : []).slice(trends.length)] };
}
