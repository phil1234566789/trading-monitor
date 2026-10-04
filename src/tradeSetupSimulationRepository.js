import { applySimulationCommission, SIMULATION_COST_VERSION } from './tradeSetupSimulationCosts.js';
import { restoreChecklistObservationChecks } from './checklistObservationRules.js';
import { encodeSnapshotStructures,decodeSnapshotStructures } from './tradeSetupSnapshotStorage.js';

const PAGE_SIZE = 500;

async function pages(query,pageSize=PAGE_SIZE) {
  const rows = [];
  for (;;) {
    const { data, error } = await query(rows.length, rows.length + pageSize - 1);
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
  return row.costVersion === SIMULATION_COST_VERSION ? applySimulationCommission(row) : row;
}

export function createSimulationRepository(db,{compactStructures=false}={}) {
  const results = (row, runId, variant, asOf) => row.outcomes.filter(result => !variant || result.variant === variant)
    .map(result => simulationAsOf({ ...result, runId, instrument: row.instrument, direction: row.direction,
      snapshotId: row.id, setupKey: row.setupKey ?? row.snapshot?.setupKey }, asOf)).filter(Boolean);
  const rpc = async (name, args) => { const { error } = await db.rpc(name, args); if (error) throw error; };
  const batches = async (name, runId, records) => {
    for (let i = 0; i < records.length; i += 100) await rpc(name, { run_id: runId, records: records.slice(i, i + 100) });
  };
  const snapshot = async (table, runId, id) => {
    const { data, error } = await db.from(table).select('snapshot').eq('run_id', runId).eq('id', id).maybeSingle();
    if (error) throw error;
    return decodeSnapshotStructures(data?.snapshot ?? null);
  };
  return {
    getRun: async (runId) => {
      const { data, error } = await db.from('trade_setup_simulation_runs').select('run').eq('id', runId).maybeSingle();
      if (error) throw error;
      return data?.run ?? null;
    },
    listReviewSnapshots: async (runId) => {
      // Prüfbelege projizieren; geteilte Strukturen im primary benötigen ihren Speicherpool.
      const fields = ['id,run_id,instrument,direction', 'knownAt:snapshot->knownAt', 'setupKey:snapshot->>setupKey',
        'dealingRange:snapshot->dealingRange', 'rangeCourse:snapshot->rangeCourse', 'priceObservation:snapshot->priceObservation', 'structureStorage:snapshot->structureStorage',
        'entry:snapshot->entry', 'm1Check:snapshot->m1Check', 'primary:snapshot->checklist->setup->primary',
        ...['model','entryModel','ruleVersion'].map(key=>`${key}:snapshot->checklist->>${key}`),
        'checklistStatus:snapshot->checklist->>status', 'evaluatedAt:snapshot->checklist->evaluatedAt',
        ...['h1Trend', 'outerM5Trend', 'm5Trend', 'liquiditySweep', 'reaction', 'targets', 'antiConfluences', 'confluences', 'time'].map(key => `${key}:snapshot->checklist->checks->${key}`),
        'm1Anchor:snapshot->checklist->checks->m5Trend->m1Anchor'];
      const groups = await Promise.all(['trade_setup_simulation_setups', 'trade_setup_simulation_entries'].map(table =>
        pages((from, to) => {
          let query = db.from(table).select(fields.join(',')).order('run_id').order('id');
          if (runId) query = query.eq('run_id', runId);
          return query.range(from, to);
        // Historische JSON-Belege erreichen das SQL-Zeitlimit vor dem Zeilenlimit.
        },10)));
      return groups.flat().map(row => decodeSnapshotStructures({ id: row.id, runId: row.run_id, instrument: row.instrument, direction: row.direction,
        ...(row.structureStorage?{structureStorage:row.structureStorage}:{}),
        knownAt: row.knownAt, setupKey: row.setupKey, entry: row.entry, m1Check: row.m1Check, dealingRange: row.dealingRange, rangeCourse: row.rangeCourse, priceObservation: row.priceObservation,
        checklist: { status: row.checklistStatus, model:row.model,entryModel:row.entryModel,ruleVersion:row.ruleVersion,
          evaluatedAt: row.evaluatedAt, setup: { primary: row.primary },
          checks: restoreChecklistObservationChecks({ h1Trend: row.h1Trend, liquiditySweep: row.liquiditySweep, reaction: row.reaction,
            targets: row.targets, antiConfluences: row.antiConfluences, confluences: row.confluences,
            time: row.time,outerM5Trend:row.outerM5Trend,m5Trend:row.m5Trend??{m1Anchor:row.m1Anchor} }) } }));
    },
    getEntry: async (runId, id) => {
      const { data, error } = await db.from('trade_setup_simulation_entries')
        .select('id,instrument,direction,outcomes,snapshot').eq('run_id', runId).eq('id', id).maybeSingle();
      if (error) throw error;
      return data ? { snapshot: decodeSnapshotStructures(data.snapshot), results: results(data, runId) } : null;
    },
    getRangeEntries: async (runId, setupKey) => {
      // Eine DR hat wenige Re-Entries. Am Serverlimit abbrechen statt still kürzen.
      const { data, error } = await db.from('trade_setup_simulation_entries')
        .select('id,instrument,direction,outcomes,snapshot').eq('run_id', runId)
        .eq('snapshot->>setupKey', setupKey).order('entry_time').limit(1000);
      if (error) throw error;
      if (data?.length === 1000) throw new Error('Zu viele Entries für eine einzelne DR.');
      return (data ?? []).map(row => ({ snapshot: decodeSnapshotStructures(row.snapshot), results: results(row, runId) }));
    },
    saveRun: run => rpc('save_trade_setup_simulation_run', { run }),
    saveEntries: (runId, records) => batches('save_trade_setup_simulation_entries', runId,
      records.map(record=>compactStructures?{...record,snapshot:encodeSnapshotStructures(record.snapshot)}:record)),
    // Bestehende rohe Snapshots behalten ihr Speicherformat für die Unveränderlichkeitsprüfung.
    saveSetups: (runId, records) => batches('save_trade_setup_simulation_setups', runId,compactStructures?records.map(encodeSnapshotStructures):records),
    listRuns: async () => (await pages((from, to) => db.from('trade_setup_simulation_runs').select('run').order('id').range(from, to))).map(row => row.run),
    listSetups: async ({ runId, instrument } = {}) => {
      const rows = await pages((from, to) => {
        let q = db.from('trade_setup_simulation_setups').select('id,instrument,known_at,direction,setupKey:snapshot->>setupKey,dealingRange:snapshot->dealingRange').eq('run_id', runId).order('id').range(from, to);
        if (instrument) q = q.eq('instrument', instrument);
        return q;
      });
      return rows.map(row => ({ id: row.id, instrument: row.instrument, knownAt: row.known_at, direction: row.direction,
        setupKey: row.setupKey, dealingRange: row.dealingRange }));
    },
    listResults: async ({ runId, instrument, variant, from, to, asOf } = {}) => {
      const rows = await pages((pageFrom, pageTo) => {
        let q = db.from('trade_setup_simulation_entries').select('id,run_id,instrument,direction,outcomes,setupKey:snapshot->>setupKey').order('run_id').order('id');
        if (runId) q = q.eq('run_id', runId);
        if (instrument) q = q.eq('instrument', instrument);
        if (Number.isFinite(from)) q = q.gte('entry_time', from);
        if (Number.isFinite(to)) q = q.lt('entry_time', to);
        if (Number.isFinite(asOf)) q = q.lte('entry_time', asOf);
        return q.range(pageFrom, pageTo);
      });
      return rows.flatMap(row => results(row, row.run_id ?? runId, variant, asOf));
    },
    getSnapshot: (runId, entryId) => snapshot('trade_setup_simulation_entries', runId, entryId),
    getSetupSnapshot: (runId, setupId) => snapshot('trade_setup_simulation_setups', runId, setupId),
  };
}
