// Reine Zählung ohne src-Importe, damit der Vitest-Check ohne Netz und Vite läuft.
const OUTCOMES = ['success', 'loss', 'ambiguous', 'open', 'unknown'];

export function aggregateDobRoutes(pairs) {
  const routes = Object.fromEntries(['a', 'b'].map(r => [r, { ...Object.fromEntries(OUTCOMES.map(s => [s, 0])), notReady: 0 }]));
  for (const pair of pairs) for (const [route, count] of Object.entries(routes)) {
    const entry = pair.entries?.[route];
    if (entry?.status !== 'ready') count.notReady++;
    // Ein unbekannter Outcome-Status darf nicht still aus der Summe fallen.
    else count[OUTCOMES.includes(entry.outcome?.status) ? entry.outcome.status : 'unknown']++;
  }
  for (const c of Object.values(routes)) {
    c.winrate = c.success + c.loss ? c.success / (c.success + c.loss) : null;
    const ready = pairs.length - c.notReady;
    c.unknownRate = ready ? c.unknown / ready : null;
    c.sumR = 2 * c.success - c.loss;
  }
  return { pairs: pairs.length, routes };
}

export function aggregateDobByMonth(pairs, monthOf) {
  const months = Map.groupBy(pairs, monthOf);
  return { total: aggregateDobRoutes(pairs),
    months: Object.fromEntries([...months.keys()].sort().map(m => [m, aggregateDobRoutes(months.get(m))])) };
}
