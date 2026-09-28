import { detectRsiDivergenceHistory, DEFAULT_DIVERGENCE_FRACTAL_PERIOD, DEFAULT_RSI_PERIOD } from './rsi.js';
import { detectOrderBlocks } from './orderBlockDetection.js';
import { closedChecklistCandles } from './tradeSetupChecklistTimeBasis.js';
import { barSecondsForTimeframeCi } from './timeframes.js';
import { formatDatedTime } from './berlinTime.js';
import { orderBlockRecognitionTimes } from './orderBlockRecognitionTime.js';
import { firstTouchAfter } from './structurePivotTime';
import { pricePrecisionForInstrument } from './format.js';

const unknown = () => ({ status: 'unknown', candidates: [] });
const evidence = candidates => ({ status: candidates.length ? 'present' : 'absent', candidates });

/** Ergebnisse sind Beobachtungen im gelieferten Präfix, keine Setup-Freigabe. */
export function detectChecklistDivergences({ candles, timeframe, evaluatedAt } = {}) {
  const duration = barSecondsForTimeframeCi(timeframe);
  if (!Array.isArray(candles) || !duration || !Number.isFinite(evaluatedAt)) return unknown();
  const rows = closedChecklistCandles(candles, timeframe, evaluatedAt);
  const period = DEFAULT_DIVERGENCE_FRACTAL_PERIOD;
  if (rows.length < DEFAULT_RSI_PERIOD + 2 * period + 1) return unknown();
  const indices = new Map(rows.map((c, i) => [c.time, i]));
  const candidates = detectRsiDivergenceHistory(rows, period, undefined, Infinity)
    // Keine Divergenz über eine ausgeschlossene Spread-Hour-Bewegung bestätigen.
    .filter(d => !rows.slice(indices.get(d.fromTime) - period, indices.get(d.toTime) + period + 1).some(c => c.ignored))
    .map(d => ({ ...d, timeframe, recognizedAt: rows[indices.get(d.toTime) + period].time + duration,
      association: 'unknown' }));
  return evidence(candidates);
}

/** OB-Start und retestedAt sind Chartanker, nicht deren Erkennungszeit. */
export function detectChecklistOrderBlocks({ candles, timeframe, evaluatedAt, minGapOverride } = {}) {
  const duration = barSecondsForTimeframeCi(timeframe);
  if (!Array.isArray(candles) || !duration || !Number.isFinite(evaluatedAt)) return unknown();
  const rows = closedChecklistCandles(candles, timeframe, evaluatedAt);
  if (rows.length < 4) return unknown();
  const label = timeframe.toLowerCase() === '1h' ? '1H' : timeframe.toLowerCase() === '4h' ? '4H' : timeframe.toLowerCase();
  const zones = detectOrderBlocks(rows, label, true, minGapOverride);
  const recognitionTimes = orderBlockRecognitionTimes(rows, timeframe);
  const formationAt = start => recognitionTimes.get(start) ?? null;
  return evidence(zones.map(z => ({ ...z, timeframe: label, recognizedAt: formationAt(z.startTime),
    touchRecognizedAt: z.touched ? z.endTime + duration : null,
    retestRecognizedAt: z.retested ? (duration < 900 ? formationAt(z.retestedAt) : z.retestedAt + duration) : null,
    mitigation: 'unknown', association: 'unknown' })));
}

function knownSnapshot(candidate, at) {
  return candidate && Number.isFinite(candidate.knownAsOf) && candidate.knownAsOf <= at
    && (!Number.isFinite(candidate.recognizedAt) || candidate.recognizedAt <= at)
    && Number.isFinite(candidate.sweep?.level?.touchedTime) && candidate.sweep.level.touchedTime + 300 <= at;
}

function knownTarget(target, at) {
  return target?.period === 5 && Number.isFinite(target.price) && Number.isFinite(target.pivotTime)
    && Number.isFinite(target.selectedAt) && target.selectedAt <= at
    && (!Number.isFinite(target.knownAt) || target.knownAt <= at);
}

function selectDivergences(result, type) {
  return result.status === 'unknown' ? result : evidence(result.candidates.filter(d => d.type === type));
}

function sweepTouchOnM5(primary, candles) {
  if (!primary) return null;
  const { level, timeframe } = primary.sweep;
  const sourceDuration = barSecondsForTimeframeCi(timeframe);
  if (!sourceDuration || !Number.isFinite(level.price) || !Number.isFinite(level.pivotTime)) return null;
  // H1 touchedTime ist der Balkenbeginn, der RSI-Pivot dagegen eine konkrete M5-Kerze.
  // Den ersten tatsächlichen Touch im Quellbalken suchen, ohne eine Nähe-Toleranz zu erfinden.
  const window = candles.filter(c => c.time >= level.touchedTime && c.time < level.touchedTime + sourceDuration);
  const touch = firstTouchAfter(window.filter(c => !c.ignored), level, sourceDuration, level.dir === -1);
  const beforeTouch = window.filter(c => c.time <= touch);
  return touch != null && beforeTouch[0]?.time === level.touchedTime
    && beforeTouch.every((c, i) => Number.isFinite(c.high) && Number.isFinite(c.low) && (!i || c.time === beforeTouch[i - 1].time + 300))
    ? touch : null;
}

function assignSweepDivergence(divergences, main, candles) {
  const touch = sweepTouchOnM5(main, candles);
  if (divergences.status === 'unknown' || touch == null) return unknown();
  // Die festgelegte G-Confluence hängt am Sweep-Top/-Bottom, nicht an beliebigen
  // älteren RSI-Linien. Eine offene, unabhängige OB-Mitigation hebt diesen Beleg nicht auf.
  return evidence(divergences.candidates.filter(d => d.toTime === touch)
    .map(d => ({ ...d, association: 'sweep-touch', candidateId: main.id, sweepTouchTime: touch })));
}

/**
 * primary/opposingCandidates: B/C-Ergebnisse; target2: festgehaltenes P5 aus D.
 * h1Candles/m5Candles: vollständige markierte Rohpräfixe, keine sichtbaren Pickerlisten.
 * Kandidaten ohne gemeinsame Pivotidentität/Bewegungsbeleg bleiben ausdrücklich unzugeordnet.
 * Keine Alters-/Distanzfenster, Stärkeformel oder Mitigationsdefinition hinzufügen.
 */
export function evaluateChecklistConfluences({ evaluatedAt, direction, instrument, primary, opposingCandidates,
  target2, h1Candles, m5Candles, minGapByTimeframe = {} } = {}) {
  const antiConfluences = { status: 'unknown', details: [], sweepCandidates: [], obCandidates: [], divergences: unknown(),
    deferredChecks: ['sweep', 'orderBlock', 'strength'] };
  const confluences = { status: 'unknown', details: [], obCandidates: [], divergences: unknown() };
  const result = { antiConfluences, confluences };
  if (!Number.isFinite(evaluatedAt) || !['long', 'short'].includes(direction)) {
    antiConfluences.details.push('Bewertungszeitpunkt oder Hauptrichtung fehlt.');
    confluences.details.push('Bewertungszeitpunkt oder Hauptrichtung fehlt.');
    return result;
  }
  const short = direction === 'short';
  antiConfluences.divergences = selectDivergences(detectChecklistDivergences({ candles: h1Candles, timeframe: '1H', evaluatedAt }), short ? 'bullish' : 'bearish');
  const main = knownSnapshot(primary, evaluatedAt) && primary.direction === direction ? primary : null;
  const m5 = closedChecklistCandles(m5Candles, '5m', evaluatedAt);
  confluences.divergences = assignSweepDivergence(
    selectDivergences(detectChecklistDivergences({ candles: m5Candles, timeframe: '5m', evaluatedAt }), short ? 'bearish' : 'bullish'), main, m5);
  const target = knownTarget(target2, evaluatedAt) && target2.dir === (short ? -1 : 1) ? target2 : null;
  const opposing = (opposingCandidates ?? []).filter(c => knownSnapshot(c, evaluatedAt) && c.direction === (short ? 'long' : 'short'));
  antiConfluences.sweepDataStatus = Array.isArray(opposingCandidates) ? 'available' : 'unknown';
  if (target) {
    antiConfluences.sweepCandidates = opposing.filter(c => c.sweep.level.pivotTime === target.pivotTime
      && c.sweep.level.price === target.price && c.sweep.level.dir === target.dir
      && barSecondsForTimeframeCi(c.sweep.timeframe) === barSecondsForTimeframeCi(target.timeframe))
      .map(c => ({ ...c, targetAssociation: 'same-pivot', olderThanPrimary: main && Number.isFinite(c.sweep.ageSeconds) && Number.isFinite(main.sweep.ageSeconds)
        ? c.sweep.ageSeconds > main.sweep.ageSeconds : null, strengthComparison: 'unknown' }));
  }
  const obResults = [
    detectChecklistOrderBlocks({ candles: h1Candles, timeframe: '1H', evaluatedAt, minGapOverride: minGapByTimeframe['1H'] }),
    detectChecklistOrderBlocks({ candles: m5Candles, timeframe: '5m', evaluatedAt, minGapOverride: minGapByTimeframe['5m'] }),
  ];
  const obs = obResults.flatMap(r => r.candidates).filter(ob => !ob.invalidated);
  const orderBlockData = { '1H': obResults[0].status, '5m': obResults[1].status };
  antiConfluences.orderBlockData = orderBlockData;
  confluences.orderBlockData = orderBlockData;
  if (target && !antiConfluences.sweepCandidates.length) {
    antiConfluences.obCandidates = obs.filter(ob => ob.dir === (short ? 1 : -1) && ob.bottom <= target.price && ob.top >= target.price)
      .map(ob => ({ ...ob, targetAssociation: 'price-overlap', originOfCounterReaction: 'unknown' }));
  }
  if (main) {
    const sweep = main.sweep.level;
    const sweepCandle = closedChecklistCandles(m5Candles, '5m', evaluatedAt).find(c => c.time === sweep.touchedTime && !c.ignored);
    confluences.obCandidates = obs.filter(ob => ob.dir === (short ? -1 : 1)
      && (short ? ob.bottom >= sweep.price : ob.top <= sweep.price)
      && ob.recognizedAt <= sweep.touchedTime && !(ob.timeframe === '5m' && ob.startTime === main.reactionOB?.startTime))
      .map(ob => ({ ...ob, touchOnSweepCandle: sweepCandle ? sweepCandle.low <= ob.top && sweepCandle.high >= ob.bottom : null,
        sameMovement: 'unknown' }));
  }
  // Sweep-/OB-Bewertung ist zurückgestellt: Grün gilt ausschließlich der H1-Prüfung.
  const counterDivergence = antiConfluences.divergences.candidates.at(-1);
  antiConfluences.status = antiConfluences.divergences.status === 'unknown' ? 'unknown' : counterDivergence ? 'pending' : 'passed';
  const counterLabel = `${short ? 'bullische' : 'bärische'} 1H Divergenz vorhanden`;
  antiConfluences.details = [antiConfluences.status === 'unknown' ? '1H-Gegendivergenz noch nicht prüfbar.'
    : counterDivergence ? counterLabel : `keine ${counterLabel}`];
  antiConfluences.explanation = 'Bewertet wird nur die H1-Gegendivergenz im geschlossenen Datenstand. Sweep-/OB-Zuordnung und Stärkevergleich sind zurückgestellt; keine Gesamtfreigabe.';
  if (counterDivergence) {
    const d = counterDivergence;
    antiConfluences.explanation += ` Gegenargument ohne festgelegte No-Go-Regel: ${formatDatedTime(d.fromTime)} → ${formatDatedTime(d.toTime)}; RSI ${d.fromRsi.toFixed(1)} → ${d.toRsi.toFixed(1)}; bestätigt ${formatDatedTime(d.recognizedAt)} (Europe/Berlin).`;
  } else if (antiConfluences.status === 'unknown') {
    antiConfluences.explanation += ' H1-Daten fehlen oder die Historie reicht nicht.';
  }
  const divergence = confluences.divergences.candidates[0];
  confluences.status = divergence ? 'passed' : confluences.divergences.status === 'unknown' ? 'unknown' : 'pending';
  if (divergence) {
    confluences.details = [`M5 ${short ? 'bärische' : 'bullische'} Divergenz`,
      `${formatDatedTime(divergence.fromTime)} → ${formatDatedTime(divergence.toTime).slice(11)} · Berlin`];
    const precision = pricePrecisionForInstrument(instrument);
    confluences.explanation = `Preis ${divergence.fromPrice.toFixed(precision)} → ${divergence.toPrice.toFixed(precision)}; RSI ${divergence.fromRsi.toFixed(1)} → ${divergence.toRsi.toFixed(1)}. Am Sweep aus B; bestätigt ${formatDatedTime(divergence.recognizedAt)} (Europe/Berlin).`;
  } else {
    confluences.details = [confluences.status === 'unknown' ? 'M5-Divergenz noch nicht prüfbar.' : 'Keine zusätzliche M5-Divergenz am Sweep.'];
    confluences.explanation = confluences.status === 'unknown' ? 'Haupt-Sweep oder vollständige M5-Daten für die Zuordnung fehlen.' : 'Optionales Zusatzargument; sein Fehlen ist kein No-Go.';
  }
  return result;
}
