export function hasConfirmedChecklistAbc(checks) {
  return ['h1Trend', 'liquiditySweep', 'reaction'].every(key => checks?.[key]?.status === 'passed');
}
