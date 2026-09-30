const PAGE_SIZE = 500;

async function pages(query) {
  const rows = [];
  for (;;) {
    const { data, error } = await query(rows.length, rows.length + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data?.length) return rows;
    rows.push(...data);
  }
}

// Historische Ansicht darf spätere Exit-Belege nicht vor ihrem Kerzenschluss zeigen.
export function simulationAsOf(result, asOf) {
  if (!Number.isFinite(asOf)) return result;
  if (result.entryTime > asOf) return null;
  const row = { ...result, evaluatedAt: Math.min(result.evaluatedAt, asOf) };
  if (result.t1RecognizedAt > asOf) Object.assign(row, { t1Time: null, t1RecognizedAt: null, t1PnlUsd: 0, realizedPnlUsd: 0 });
  if (result.exitRecognizedAt > asOf || (result.status === 'ambiguous' && (result.ambiguityRecognizedAt ?? result.evaluatedAt) > asOf)) {
    Object.assign(row, { status: 'open', reason: null, outcome: null, exitTime: null, exitRecognizedAt: null,
      exitPrice: null, pnlUsd: null, rMultiple: null, ambiguityRecognizedAt: null,
      realizedPnlUsd: row.t1Time == null ? 0 : result.t1PnlUsd ?? 0 });
  }
  return row;
}

export function createSimulationRepository(db) {
  const rpc = async (name, args) => { const { error } = await db.rpc(name, args); if (error) throw error; };
  const batches = async (name, runId, records) => {
    for (let i = 0; i < records.length; i += 100) await rpc(name, { run_id: runId, records: records.slice(i, i + 100) });
  };
  const snapshot = async (table, runId, id) => {
    const { data, error } = await db.from(table).select('snapshot').eq('run_id', runId).eq('id', id).maybeSingle();
    if (error) throw error;
    return data?.snapshot ?? null;
  };
  return {
    saveRun: run => rpc('save_trade_setup_simulation_run', { run }),
    saveEntries: (runId, records) => batches('save_trade_setup_simulation_entries', runId, records),
    saveSetups: (runId, records) => batches('save_trade_setup_simulation_setups', runId, records),
    listRuns: async () => (await pages((from, to) => db.from('trade_setup_simulation_runs').select('run').order('id').range(from, to))).map(row => row.run),
    listSetups: async ({ runId, instrument } = {}) => {
      const rows = await pages((from, to) => {
        let q = db.from('trade_setup_simulation_setups').select('id,instrument,known_at,direction').eq('run_id', runId).order('id').range(from, to);
        if (instrument) q = q.eq('instrument', instrument);
        return q;
      });
      return rows.map(row => ({ id: row.id, instrument: row.instrument, knownAt: row.known_at, direction: row.direction }));
    },
    listResults: async ({ runId, instrument, variant, from, to, asOf } = {}) => {
      const rows = await pages((pageFrom, pageTo) => {
        let q = db.from('trade_setup_simulation_entries').select('id,instrument,direction,outcomes').eq('run_id', runId).order('id').range(pageFrom, pageTo);
        if (instrument) q = q.eq('instrument', instrument);
        if (Number.isFinite(from)) q = q.gte('entry_time', from);
        if (Number.isFinite(to)) q = q.lt('entry_time', to);
        if (Number.isFinite(asOf)) q = q.lte('entry_time', asOf);
        return q;
      });
      return rows.flatMap(row => row.outcomes.filter(result => !variant || result.variant === variant)
        .map(result => simulationAsOf({ ...result, runId, instrument: row.instrument, direction: row.direction,
          snapshotId: row.id }, asOf)).filter(Boolean));
    },
    getSnapshot: (runId, entryId) => snapshot('trade_setup_simulation_entries', runId, entryId),
    getSetupSnapshot: (runId, setupId) => snapshot('trade_setup_simulation_setups', runId, setupId),
  };
}
