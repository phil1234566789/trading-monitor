import { collectNestedChain, isUntouchedAsOf } from './marketStructureAnalysis';
import { firstTouchAfter } from './structurePivotTime';
import { closedChecklistCandles } from './tradeSetupChecklistTimeBasis.js';
import { findNearestLiquidityTargets } from './findTargets.js';
import { bonusLabelForPivot, buildSessionContextLookup, markIgnoredCandles } from './sessionOccurrences.js';
import { berlinOffsetMinutes } from './berlinTime.js';
import { barSecondsForTimeframeCi } from './timeframes.js';

const offsetAt = seconds => berlinOffsetMinutes(seconds * 1000);
const localDate = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit' });

function closedMarkedCandles(candles, bar, evaluatedAt, sessions) {
  return markIgnoredCandles(closedChecklistCandles(candles, bar, evaluatedAt), sessions, offsetAt);
}

/**
 * state: H1-Struktur aus dem geschlossenen Präfix am Auswahlzeitpunkt evaluatedAt.
 * Ein späterer State lässt sich hier nicht auf einen früheren Strukturstand zurückrechnen.
 * h1Candles optional: zusätzliche Prüfung der tatsächlich geschlossenen Bestätigungskerzen.
 * labelCandles/labelBar optional: feinere Session-Extrema, ebenfalls strikt bis evaluatedAt.
 * Rückgabe target1=P2 (Pflicht), target2=P5 (optional); keine Entry-/TP-Abstände.
 */
export function evaluateChecklistTargets({ state, direction, referencePrice, evaluatedAt, instrument,
  h1Candles, m5Candles, sessionConfigs = [], labelCandles = h1Candles, labelBar = '1h' } = {}) {
  const result = { status: 'unknown', details: [], target1: null, target2: null,
    selectedAt: evaluatedAt, referencePrice, direction, instrument };
  if (!Number.isFinite(evaluatedAt) || !Number.isFinite(referencePrice) || !['long', 'short'].includes(direction)) {
    return { ...result, details: ['Richtung, Referenzpreis oder Auswahlzeitpunkt fehlt.'] };
  }
  if (!state || !Array.isArray(state.innerStructurePivots) || !Array.isArray(state.structurePivots)) {
    return { ...result, details: ['H1-Struktur für die Zielauswahl fehlt.'] };
  }
  const sessions = sessionConfigs.filter(s => s.instrument == null || s.instrument === instrument);
  const h1 = h1Candles == null ? null : closedMarkedCandles(h1Candles, '1h', evaluatedAt, sessions).filter(c => !c.ignored);
  const m5 = closedMarkedCandles(m5Candles, '5m', evaluatedAt, sessions).filter(c => !c.ignored);
  const labelRows = closedMarkedCandles(labelCandles, labelBar, evaluatedAt, sessions).filter(c => !c.ignored);
  const chain = collectNestedChain(state);
  const candidates = [];
  const missingConfirmationHistory = new Set();
  chain.forEach((level, depth) => {
    for (const [source, period] of [['innerStructurePivots', 2], ['structurePivots', 5]]) {
      for (const p of level[source] ?? []) {
        // LQ-sweep/BOS kodiert keine Seite. Der aktuelle Trend beweist deren ursprüngliche Seite nicht.
        const dir = /(?:^|-)high$/.test(p.type) ? 1 : /(?:^|-)low$/.test(p.type) ? -1 : null;
        if (dir !== (direction === 'long' ? 1 : -1) || !Number.isFinite(p.price) || !Number.isFinite(p.pivotTime)) continue;
        if (!(direction === 'long' ? p.price > referencePrice : p.price < referencePrice)) continue;
        if (p.pivotTime >= evaluatedAt || p.ignored || !isUntouchedAsOf(p, evaluatedAt)) continue;
        if (markIgnoredCandles([{ time: p.pivotTime }], sessions, offsetAt)[0].ignored) continue;
        if (firstTouchAfter(m5, p, 3600, dir === -1) != null) continue;
        let knownAt = null;
        if (h1 != null) {
          const index = h1.findIndex(c => c.time === p.pivotTime);
          if (index === -1) { missingConfirmationHistory.add(period); continue; }
          // Perioden zählen echte Kerzen, keine Uhrstunden: Wochenende/Spread Hour sind Lücken.
          if (!h1[index + period]) continue;
          knownAt = h1[index + period].time + 3600;
        }
        candidates.push({ id: [instrument ?? '', '1h', period, p.pivotTime, dir, p.price].join(':'),
          price: p.price, pivotTime: p.pivotTime, sourceTime: p.pivotTime, timeframe: '1h',
          period, source, depth, dir, pivotType: p.type, knownAt, selectedAt: evaluatedAt, touched: false });
      }
    }
  });
  // Gleiche Preise bekommen eine feste Reihenfolge; Nested-Promotionen ändern nicht die Objekt-ID.
  candidates.sort((a, b) => a.pivotTime - b.pivotTime || a.id.localeCompare(b.id) || a.depth - b.depth);
  const unique = [...new Map(candidates.slice().reverse().map(p => [p.id, p])).values()]
    .sort((a, b) => a.pivotTime - b.pivotTime || a.id.localeCompare(b.id));
  const start = unique.length ? Math.min(...unique.map(p => p.pivotTime)) : evaluatedAt;
  // Die bestehende Label-Funktion hat einen zeitbasierten Fallback. Für automatische
  // Targets nur Vorkommen mit wirklichen Preisbelegen weitergeben, sonst beim P2/P5-Label bleiben.
  const lookup = buildSessionContextLookup(sessions, start, evaluatedAt, offsetAt, labelRows)
    .map(session => ({ ...session, occurrences: session.occurrences.filter(o => o.rangeHigh != null && o.rangeLow != null) }));
  const select = period => {
    const target = findNearestLiquidityTargets(unique.filter(p => p.period === period), { direction, currentPrice: referencePrice, limit: 1 })[0];
    if (!target) return null;
    const sessionLabel = bonusLabelForPivot(target.pivotTime, target.dir, target.price, lookup);
    return { ...target, sessionLabel,
      label: [`1h P${period}`, sessionLabel, localDate.format(new Date(target.pivotTime * 1000))].filter(Boolean).join(' · ') };
  };
  result.target1 = missingConfirmationHistory.has(2) ? null : select(2);
  result.target2 = missingConfirmationHistory.has(5) ? null : select(5);
  result.status = missingConfirmationHistory.has(2) ? 'unknown' : result.target1 ? 'passed' : 'pending';
  result.details = [result.target1 ? `${result.target1.label}: ${result.target1.price}` : 'Noch kein unberührtes P2-Ziel auf der Zielseite.',
    result.target2 ? `${result.target2.label}: ${result.target2.price}` : 'Kein zusätzliches P5-Ziel; das zweite Ziel ist optional.'];
  for (const period of missingConfirmationHistory) result.details.push(`H1-Historie zur Bestätigung mindestens eines P${period}-Zielkandidaten fehlt.`);
  return result;
}

/** Prüft die festgehaltene Auswahl; ersetzt niemals ein angelaufenes Target durch ein neues. */
export function evaluateChecklistTargetValidity(selection, { evaluatedAt, candles = [], bar = '5m', sessionConfigs = [],
  instrument = selection?.instrument } = {}) {
  const result = { status: 'unknown', details: [], target1: selection?.target1 ?? null, target2: selection?.target2 ?? null,
    target1TouchedAt: null, endedAt: null, evaluatedAt };
  const duration = barSecondsForTimeframeCi(bar);
  if (!selection?.target1 || selection.status !== 'passed' || !duration || !Number.isFinite(evaluatedAt)
    || !Number.isFinite(selection.selectedAt) || evaluatedAt < selection.selectedAt) {
    return { ...result, details: ['Gültige Zielauswahl oder Bewertungszeit fehlt.'] };
  }
  if (evaluatedAt === selection.selectedAt) return { ...result, status: 'passed', details: ['Ziel 1 zum Auswahlzeitpunkt unberührt.'] };
  const sessions = sessionConfigs.filter(s => s.instrument == null || s.instrument === instrument);
  const rows = closedMarkedCandles(candles, bar, evaluatedAt, sessions).filter(c => c.time >= selection.selectedAt);
  const touchedAt = firstTouchAfter(rows.filter(c => !c.ignored),
    { price: selection.target1.price, pivotTime: selection.selectedAt - duration }, duration, selection.direction === 'short');
  if (touchedAt != null) return { ...result, status: 'blocked', target1TouchedAt: touchedAt, endedAt: touchedAt + duration,
    details: ['Ziel 1 wurde angelaufen; diese Zielauswahl ist beendet.'] };
  // Fehlende Balken und ein Auswahlzeitpunkt innerhalb eines Balkens beweisen kein Weiterleben.
  const through = Math.floor(evaluatedAt / duration) * duration;
  const complete = rows.length > 0 && rows[0].time === selection.selectedAt
    && rows.at(-1).time + duration === through
    && rows.every((c, i) => i === 0 || c.time === rows[i - 1].time + duration);
  return { ...result, status: complete ? 'passed' : 'unknown', details: [complete
    ? 'Ziel 1 in den geschlossenen Kerzen seit der Auswahl unberührt.'
    : 'Kerzenabdeckung seit der Zielauswahl unvollständig; Zielgültigkeit unbekannt.'] };
}
