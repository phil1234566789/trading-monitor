export function hasConfirmedChecklistAbc(checks) {
  const trend = checks?.outerM5Trend ? 'outerM5Trend' : 'h1Trend';
  return [trend, 'liquiditySweep', 'reaction'].every(key => checks?.[key]?.status === 'passed');
}
