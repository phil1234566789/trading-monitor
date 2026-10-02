import { activeM1Context, buildM1Structure, M1_STRUCTURE_PERIOD } from './m1Structure.js';
import { SETUP2_VERSION } from './tradeSetup2Configuration.js';
import { markIgnoredCandles } from './sessionOccurrences.js';
import { berlinOffsetMinutes } from './berlinTime.js';
import { closedChecklistCandles } from './tradeSetupChecklistTimeBasis.js';

export const SNAPSHOT_INDICATOR_PROPS = ['showRanges', 'showM5Structure', 'showM1Structure',
  'showLiquidity', 'showObsM5', 'showRsiDivergence', 'showRsiDivergenceHistory'];

export function snapshotEvidenceVisible(e, props = {}) {
  if (e.role === 'divergence') return props.showRsiDivergence !== false || props.showRsiDivergenceHistory === true;
  if (e.role === 'reactionOB') return props.showObsM5 !== false;
  if (['sweep', 'target1', 'target2'].includes(e.role)) return props.showLiquidity !== false;
  const key = { '1h': 'showRanges', '5m': 'showM5Structure', '1m': 'showM1Structure' }[e.timeframe];
  if (key && props[key] === false) return false;
  return true;
}

// Maximal wenige Tage pro Auswahl; lange/alte Läufe lösen keinen Jahresscan aus.
const MAX_M1_CANDLES = 5000;
export function createSnapshotM1Reader(repository, fetchCandles) {
  const pending = new Map();
  return (runId, snapshot) => {
    const key = `${runId}:${snapshot.id}:${snapshot.knownAt}`;
    if (!pending.has(key)) {
      const request = load(runId, snapshot).catch(error => { pending.delete(key); throw error; });
      pending.set(key, request);
      if (pending.size > 8) pending.delete(pending.keys().next().value);
    }
    return pending.get(key);
  };
  async function load(runId, snapshot) {
    const unavailable = message => ({ result: null, message });
    const context = activeM1Context(snapshot.checklist);
    if (!context || context.instrument !== snapshot.instrument
      || ![snapshot.knownAt, context.anchor.pivotTime, context.anchor.recognizedAt, context.anchor.price].every(Number.isFinite)
      || context.anchor.recognizedAt > snapshot.knownAt) {
      return unavailable('M1-Ergänzung nicht verfügbar: kein bestätigter gespeicherter Anker.');
    }
    const run = await repository.getRun(runId);
    const config = run?.configuration?.instruments?.find(c => c.instrument === snapshot.instrument) ?? run?.configuration;
    if (config?.instrument !== snapshot.instrument || config.setupVersion !== SETUP2_VERSION
      || config.m1Period !== M1_STRUCTURE_PERIOD || !Array.isArray(config.sessions)) {
      return unavailable('M1-Ergänzung nicht verfügbar: passende Algorithmusversion oder gespeicherte Sessions fehlen.');
    }
    const at = snapshot.knownAt;
    // Zusätzlicher Vorlauf überbrückt ignorierte Spread-Hour-Kerzen. Reicht er
    // nicht, bleibt der gespeicherte Beleg sichtbar statt eine Teilstruktur zu behaupten.
    const leadIn = M1_STRUCTURE_PERIOD * 2 + 1 + 120;
    const count = Math.ceil((at - context.anchor.pivotTime) / 60) + leadIn;
    if (!Number.isFinite(count) || count < leadIn || count > MAX_M1_CANDLES) {
      return unavailable('M1-Ergänzung nicht verfügbar: Anker außerhalb des begrenzten Archivfensters.');
    }
    const rows = closedChecklistCandles(await fetchCandles(snapshot.instrument, count, at), '1m', at);
    // Bei einer Lücke ab dem Anker ist die damalige Fraktalfolge nicht belegbar.
    if (rows.some((c, i) => i > 0 && c.time >= context.anchor.pivotTime && c.time - rows[i - 1].time > 60)) {
      return unavailable('M1-Ergänzung nicht verfügbar: unterbrochenes Archivfenster ab dem Anker.');
    }
    const marked = markIgnoredCandles(rows, config.sessions.filter(s => s.instrument === snapshot.instrument),
      sec => berlinOffsetMinutes(sec * 1000));
    const result = buildM1Structure(marked, context.anchor, at);
    if (result.status !== 'ready' || rows.at(-1)?.time + 60 !== at) {
      return unavailable('M1-Ergänzung nicht verfügbar: Archiv oder Fraktalvorlauf unvollständig.');
    }
    return { result, message: `M1-Pivots aus Archiv ergänzt · P5 · ${result.pivotsOuter.length} Pivots · bis zum gespeicherten Stand · sichtbar mit Debug` };
  }
}
