import { CHECKLIST_RULE_VERSION, evaluateChecklistLifecycle } from './tradeSetupChecklistLifecycle.js';
import { markIgnoredCandles } from './sessionOccurrences.js';
import { berlinOffsetMinutes } from './berlinTime.js';

export function checklistStatisticsConfiguration(settings = {}, sessions = [], instrument) {
  return {
    feed: 'fxcm-bid', timezone: 'Europe/Berlin',
    rangesPeriod: settings.rangesPeriod ?? 5, ranges2Period: settings.ranges2Period ?? 2,
    rangesLookbackHours: settings.rangesLookbackHours ?? 168, ranges2LookbackHours: settings.ranges2LookbackHours ?? 168,
    rangesFixedStartActive: settings.rangesFixedStartActive ?? false, rangesFixedStartTime: settings.rangesFixedStartTime ?? null,
    sessions: sessions.filter(s => s.instrument == null || s.instrument === instrument).map(s => ({
      label: s.label, fromMinutes: s.fromMinutes, toMinutes: s.toMinutes, days: s.days ?? null,
      highLowRelevant: !!s.highLowRelevant, ignoreLiquidity: !!s.ignoreLiquidity,
    })),
  };
}

export async function checklistConfigurationKey(configuration) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(configuration)));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

/** Ein Datensatz je Kandidat und Regel-/Konfigurationsstand, keine Zeile je Auswertung. */
export function createChecklistStatisticsStore(db) {
  return {
    async save(result, settings, sessions) {
      if (result.status !== 'ready' || !result.setup) return 0;
      const configuration = checklistStatisticsConfiguration(settings, sessions, result.instrument);
      const configKey = await checklistConfigurationKey(configuration);
      const records = new Map();
      // Auch nach T1 oder nach Wegfall aus dem aktuellen H1-Baum weiter beobachten.
      // Gespeicherte spätere Ergebnisse fließen niemals in die Replay-Anzeige ein.
      for (let offset = 0; ;) {
        const { data, error } = await db.from('checklist_target_observations').select('candidate_id,selection,invalidation,source')
          .eq('instrument', result.instrument).eq('rule_version', CHECKLIST_RULE_VERSION).eq('config_key', configKey)
          .lte('selected_at', result.evaluatedAt).order('candidate_id').range(offset, offset + 499);
        if (error) throw error;
        if (!data?.length) break;
        data.forEach(row => records.set(row.candidate_id, row));
        offset += data.length;
      }
      for (const c of result.setup.candidates) {
        if (c.targetSelection?.status !== 'passed' || !Number.isFinite(c.invalidation)) continue;
        if (!records.has(c.id)) records.set(c.id, { candidate_id: c.id, selection: c.targetSelection,
          invalidation: c.invalidation, source: { sweep: c.sweep, reactionOB: c.reactionOB, reactionRecognizedAt: c.reactionRecognizedAt } });
      }
      const candles = markIgnoredCandles(result.context.m5Candles, configuration.sessions, sec => berlinOffsetMinutes(sec * 1000));
      const rows = [...records.values()].map(row => ({ ...row, instrument: result.instrument,
        rule_version: CHECKLIST_RULE_VERSION, config_key: configKey, configuration,
        selected_at: row.selection.selectedAt, evaluated_at: result.evaluatedAt,
        observation: evaluateChecklistLifecycle({ selection: row.selection, invalidation: row.invalidation, candles, evaluatedAt: result.evaluatedAt }),
      }));
      for (let offset = 0; offset < rows.length; offset += 100) {
        const { error } = await db.rpc('save_checklist_target_observations', { observations: rows.slice(offset, offset + 100) });
        if (error) throw error;
      }
      return rows.length;
    },
  };
}
