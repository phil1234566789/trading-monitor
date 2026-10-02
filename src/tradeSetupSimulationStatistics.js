import { berlinDayRangeUtcMs } from './berlinTime.js';
export const MIN_SIMULATION_WINRATE_CASES = 50;

export const SIMULATION_OUTCOME_LABELS = {
  slBeforeT1: 'SL vor T1', t1Be: 'T1 + Break-even', t2: 'T2',
  open: 'Offen', ambiguous: 'Uneindeutig', notExecutable: 'Nicht ausführbar',
};
export const SIMULATION_REASON_LABELS = {
  missingHistory: 'Historie unvollständig', sameCandle: 'Reihenfolge innerhalb der Kerze unbekannt',
  unsupportedInstrument: 'Instrument für diese Simulation noch nicht unterstützt',
  invalidStop: 'Stopp nicht ausführbar', invalidTargets: 'Ziele nicht ausführbar',
  belowOneLot: 'Risikobudget reicht nicht für ein ganzes Lot', invalidSizing: 'Größenregel nicht gültig belegt',
};

export function simulationOutcomeKey(row) {
  return row.status === 'closed' ? row.outcome : row.status;
}

export function simulationRunStatusLabel(run) {
  if (run.progress?.phase === 'paused') return 'Unterbrochen';
  return { running: 'Läuft', complete: 'Abgeschlossen', failed: 'Fehlgeschlagen' }[run.status] ?? run.status;
}

export function simulationStatistics(rows, variant, basis = 'gross') {
  const pnlField = basis === 'net' ? 'netPnlUsd' : 'pnlUsd';
  const rField = basis === 'net' ? 'netRMultiple' : 'rMultiple';
  const selected = rows.filter(row => row.variant === variant);
  const counts = Object.fromEntries(Object.keys(SIMULATION_OUTCOME_LABELS).map(key => [key, 0]));
  const closed = [];
  for (const row of selected) {
    const key = simulationOutcomeKey(row);
    if (key in counts) counts[key]++;
    if (row.status === 'closed' && ['slBeforeT1', 't1Be', 't2'].includes(row.outcome)
      && Number.isFinite(row[pnlField]) && Number.isFinite(row[rField])) closed.push(row);
  }
  const wins = closed.filter(row => row[pnlField] > 0).length;
  const losses = closed.filter(row => row[pnlField] < 0).length;
  return {
    total: selected.length, counts, closed: closed.length, wins, losses,
    // Philip erlaubt Prozentwerte ab 50 entschiedenen Fällen (PLAN-dr-statistik-ui.md).
    winrate: closed.length >= MIN_SIMULATION_WINRATE_CASES ? wins / closed.length * 100 : null,
    pnlUsd: closed.length ? closed.reduce((sum, row) => sum + row[pnlField], 0) : null,
    totalR: closed.length ? closed.reduce((sum, row) => sum + row[rField], 0) : null,
  };
}

export function simulationRunLink(runId, variant = 'wide') {
  return { path: '/statistik', query: { run: runId, variant } };
}

export function simulationDateFilter(from, to) {
  if (from && to && from > to) throw new Error('Das Enddatum muss am oder nach dem Startdatum liegen.');
  // Die nächste Berliner Mitternacht separat bestimmen: DST-Tage haben 23/25 Stunden.
  const nextDay = to ? new Date(Date.parse(`${to}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10) : null;
  return {
    from: from ? berlinDayRangeUtcMs(from).startUtcMs / 1000 : undefined,
    to: nextDay ? berlinDayRangeUtcMs(nextDay).startUtcMs / 1000 : undefined,
  };
}

export function simulationChartLink(row, runId) {
  return { path: '/', query: {
    setup2: row.snapshotId ?? row.entryId ?? row.id, run: runId, variant: row.variant,
    instrument: row.instrument, replay: String(row.entryTime ?? row.knownAt), bar: '5m',
  } };
}
