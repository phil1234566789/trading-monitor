import { computeRangesPivots, buildMarketStructureState } from './marketStructureAnalysis';
import { markIgnoredCandles } from './sessionOccurrences.js';
import { berlinOffsetMinutes } from './berlinTime.js';
import { barSecondsFor } from './timeframes.js';
import { evaluateChecklistTime } from './tradeSetupChecklistTime.js';
import { closedChecklistCandles } from './tradeSetupChecklistTimeBasis.js';
export { closedChecklistCandles } from './tradeSetupChecklistTimeBasis.js';

export function checklistEvaluationTime(replayUntil, nowSec, replayMode = null) {
  if (replayUntil == null) return nowSec;
  // Die UI-Semantik bleibt offen, bis Philip eine der beiden Varianten festlegt.
  if (replayMode === 'strict') return replayUntil;
  if (replayMode === 'm5-close') return replayUntil + barSecondsFor('5m');
  return null;
}

function openChecks() {
  const pending = { status: 'pending', details: ['Automatische Prüfung folgt in einem weiteren Schritt.'] };
  return {
    h1Trend: { status: 'unknown', details: ['1-Stunden-Struktur noch nicht bestimmbar.'] },
    liquiditySweep: { ...pending }, reaction: { ...pending }, targets: { ...pending },
    antiConfluences: { ...pending },
    time: { status: 'unknown', details: ['Session- und News-Prüfung noch nicht angebunden.'] },
    confluences: { ...pending },
    m5Trend: { status: 'deferred', details: ['Frühere M5-Drehung wird später präzisiert.'] },
    m1: { status: 'deferred', details: ['M1-Regeln sind zurückgestellt.'] },
  };
}

// Keine sichtbaren Linien oder heutigen DB-Setups: jeder Aufruf rekonstruiert den
// damaligen Wissensstand aus dem geschlossenen Präfix, einschließlich rechter Pivot-Bestätigung.
export function evaluateTradeSetupChecklist({ instrument, evaluatedAt, h1Candles = [], m5Candles = [], settings = {}, sessionConfigs = [], dataStatus = 'ready', tradingWindows, news, newsCoverage }) {
  const checks = openChecks();
  checks.time = evaluateChecklistTime({ instrument, evaluatedAt, sessions: sessionConfigs, tradingWindows, news, newsCoverage });
  const result = { instrument, evaluatedAt, status: dataStatus, checks, direction: null };
  if (!Number.isFinite(evaluatedAt)) {
    result.status = 'missing';
    checks.h1Trend.details = ['Replay-Bewertungszeit noch nicht festgelegt.'];
    return result;
  }
  if (dataStatus === 'loading' || dataStatus === 'error') {
    checks.h1Trend.details = [dataStatus === 'loading' ? 'Kerzendaten werden geladen.' : 'Kerzendaten konnten nicht geladen werden.'];
    return result;
  }
  const h1 = closedChecklistCandles(h1Candles, '1h', evaluatedAt);
  const m5 = closedChecklistCandles(m5Candles, '5m', evaluatedAt);
  if (!h1.length || !m5.length) result.status = 'missing';
  else if (h1.at(-1).time + 3600 < Math.floor(evaluatedAt / 3600) * 3600 || m5.at(-1).time + 300 < Math.floor(evaluatedAt / 300) * 300) result.status = 'stale';
  if (result.status !== 'ready') {
    checks.h1Trend.details = [result.status === 'stale' ? 'Geschlossene Kerzen fehlen am Bewertungsstand; Daten veraltet.' : 'M5- oder H1-Kerzendaten fehlen.'];
    return result;
  }
  const context = buildChecklistMarketContext({ instrument, evaluatedAt, h1Candles: h1, m5Candles: m5, settings, sessionConfigs });
  const state = context.h1State;
  result.context = context;
  // Nur der Haupttrend bestimmt die Richtung. Die verschachtelte Gegenrichtung bleibt
  // im vollständigen Strukturbaum für spätere Sweep-/Anti-Confluence-Auswertung erhalten.
  result.structure = state;
  result.direction = context.direction;
  if (result.direction) {
    checks.h1Trend = { status: 'passed', details: [state.trend === 'uptrend' ? 'Bullisch — Hauptcheckliste für Long.' : 'Bärisch — Hauptcheckliste für Short.'] };
  }
  return result;
}

export function buildChecklistMarketContext({ instrument, evaluatedAt, h1Candles = [], m5Candles = [], settings = {}, sessionConfigs = [] }) {
  const configs = sessionConfigs.filter(s => s.instrument === instrument);
  const mark = (rows, bar) => markIgnoredCandles(closedChecklistCandles(rows, bar, evaluatedAt), configs, sec => berlinOffsetMinutes(sec * 1000));
  const h1 = mark(h1Candles, '1h');
  const m5 = mark(m5Candles, '5m');
  const structureCandles = h1.filter(c => !c.ignored);
  const { rangesPeriod = 5, ranges2Period = 2, rangesLookbackHours = 168, ranges2LookbackHours = 168, rangesFixedStartActive = false, rangesFixedStartTime = null } = settings;
  const cutoff = hours => rangesFixedStartActive && rangesFixedStartTime != null ? rangesFixedStartTime : evaluatedAt - hours * 3600;
  const outer = computeRangesPivots(structureCandles, rangesPeriod, cutoff(rangesLookbackHours));
  const inner = computeRangesPivots(structureCandles, ranges2Period, cutoff(ranges2LookbackHours));
  const state = buildMarketStructureState(outer, inner, rangesPeriod, ranges2Period, structureCandles);
  return { instrument, evaluatedAt, h1Candles: h1, m5Candles: m5, h1State: state, h1Pivots: { outer, inner },
    direction: state?.trend === 'uptrend' ? 'long' : state?.trend === 'downtrend' ? 'short' : null };
}
