import { firstTouchAfter } from './structurePivotTime';
import { closedChecklistCandles } from './tradeSetupChecklistTimeBasis.js';
import { findNearestLiquidityTargets } from './findTargets.js';
import { detectLiquidityLevels, LIQUIDITY_FRACTAL_PERIOD } from './liquidityDetection.js';
import { bonusLabelForPivot, buildSessionContextLookup, markIgnoredCandles } from './sessionOccurrences.js';
import { berlinOffsetMinutes } from './berlinTime.js';
import { barSecondsForTimeframeCi } from './timeframes.js';
import { ageReferenceTime, businessSecondsBetween, formatAge } from './chartTimeUtils.js';

const offsetAt = seconds => berlinOffsetMinutes(seconds * 1000);

function closedMarkedCandles(candles, bar, evaluatedAt, sessions) {
  return markIgnoredCandles(closedChecklistCandles(candles, bar, evaluatedAt), sessions, offsetAt);
}

// Zuerst das Extrem je Session bestimmen; der nächste einzelne Pivot würde dieselbe
// Session mehrfach als Ziel anbieten. Zeitreihenfolge ersetzt keine Preisrichtung.
export function selectChecklistSessionTargets(levels, { direction, referencePrice }) {
  if (!['long', 'short'].includes(direction) || !Number.isFinite(referencePrice)) return [];
  const dir = direction === 'short' ? -1 : 1;
  const eligible = findNearestLiquidityTargets(levels.filter(p => p.dir === dir && p.sessionKey), {
    direction, currentPrice: referencePrice, limit: Infinity,
  }).sort((a, b) => a.pivotTime - b.pivotTime || a.sessionKey.localeCompare(b.sessionKey));
  const extremes = new Map();
  for (const p of eligible) {
    const previous = extremes.get(p.sessionKey);
    if (!previous || (dir === -1 ? p.price < previous.price : p.price > previous.price)) extremes.set(p.sessionKey, p);
  }
  const ordered = findNearestLiquidityTargets([...extremes.values()], { direction, currentPrice: referencePrice, limit: Infinity });
  const target1 = ordered[0];
  if (!target1) return [];
  const target2 = ordered.find(p => p.sessionKey !== target1.sessionKey && (dir === -1 ? p.price < target1.price : p.price > target1.price));
  return target2 ? [target1, target2] : [target1];
}

/** Nur ein tatsächlich gewähltes Drehungslevel ersetzen; eigenständige Sessionziele bleiben unverändert. */
export function replaceChecklistTargets(levels, { direction, referencePrice, excludedTargets = [] }) {
  const selected = selectChecklistSessionTargets(levels, { direction, referencePrice });
  const excluded = p => excludedTargets.some(e => e.pivotTime === p.pivotTime && e.dir === p.dir && e.price === p.price);
  if (!selected.some(excluded)) return selected;
  const targets = selected.filter(p => !excluded(p));
  const replacements = findNearestLiquidityTargets(levels.filter(p => !excluded(p)), {
    direction, currentPrice: targets.at(-1)?.price ?? referencePrice, limit: Infinity,
  });
  return [...targets, ...replacements].slice(0, 2);
}

/** Geschlossene M5-Pivots, je Session tiefstes (Short) bzw. höchstes (Long) zulässiges Level. */
export function evaluateChecklistTargets({ direction, referencePrice, evaluatedAt, instrument,
  m5Candles, sessionConfigs = [], excludedTargets = [] } = {}) {
  const result = { status: 'unknown', details: [], target1: null, target2: null,
    selectedAt: evaluatedAt, referencePrice, direction, instrument };
  if (!Number.isFinite(evaluatedAt) || !Number.isFinite(referencePrice) || !['long', 'short'].includes(direction)) {
    return { ...result, details: ['Richtung, Referenzpreis oder Auswahlzeitpunkt fehlt.'] };
  }
  const sessions = sessionConfigs.filter(s => s.instrument == null || s.instrument === instrument);
  const rows = closedMarkedCandles(m5Candles, '5m', evaluatedAt, sessions);
  const period = LIQUIDITY_FRACTAL_PERIOD;
  const usable = rows.filter(c => !c.ignored);
  if (usable.length < 2 * period + 5 || !sessions.some(s => s.highLowRelevant)) {
    return { ...result, details: ['M5-Pivothistorie oder relevante Sessionkonfiguration fehlt.'] };
  }
  // Dieselbe Erkennung wie im Chart; Rohkerzen-Minima und angepinnte TP-Preise sind keine Kandidaten.
  const pivots = detectLiquidityLevels(rows, period);
  const lookup = buildSessionContextLookup(sessions, rows[0].time, evaluatedAt, offsetAt, rows);
  const indices = new Map(usable.map((c, i) => [c.time, i]));
  const levels = (direction === 'short' ? pivots.lows : pivots.highs).flatMap(p => {
    const session = lookup.find(s => s.occurrences.some(o => p.pivotTime >= o.startSec && p.pivotTime < o.endSec));
    const occurrence = session?.occurrences.find(o => p.pivotTime >= o.startSec && p.pivotTime < o.endSec);
    const knownAt = usable[indices.get(p.pivotTime) + period].time + 300;
    const sessionKey = occurrence ? [session.label, occurrence.startSec, occurrence.endSec].join(':') : null;
    const sessionLabel = bonusLabelForPivot(p.pivotTime, p.dir, p.price, lookup);
    const ageSeconds = businessSecondsBetween(p.pivotTime, ageReferenceTime(p.touchedTime, evaluatedAt));
    const ageText = formatAge(ageSeconds);
    return [{ ...p, id: [instrument ?? '', '5m', period, p.pivotTime, p.dir, p.price].join(':'),
      sourceTime: p.pivotTime, timeframe: '5m', period, source: occurrence ? 'sessionLiquidity' : 'liquidity', knownAt, selectedAt: evaluatedAt,
      sessionKey, sessionName: session?.label ?? null, sessionStart: occurrence?.startSec ?? null, sessionEnd: occurrence?.endSec ?? null,
      sessionLabel, ageSeconds, ageText, label: `${sessionLabel ?? session?.label ?? 'M5 Pivot'} (${ageText})` }];
  });
  [result.target1 = null, result.target2 = null] = replaceChecklistTargets(levels, { direction, referencePrice, excludedTargets });
  result.status = result.target1 ? 'passed' : 'pending';
  result.details = [result.target1 ? `${result.target1.label}: ${result.target1.price}` : 'Noch kein unberührtes Session-Pivot auf der Zielseite.',
    result.target2 ? `${result.target2.label}: ${result.target2.price}` : 'Kein weiterführendes Ziel; das zweite Ziel ist optional.'];
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
