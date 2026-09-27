import { detectRsiDivergenceHistory, DEFAULT_DIVERGENCE_FRACTAL_PERIOD, DEFAULT_RSI_PERIOD } from './rsi.js';
import { detectOrderBlocks } from './orderBlockDetection.js';
import { closedChecklistCandles } from './tradeSetupChecklistTimeBasis.js';
import { barSecondsForTimeframeCi } from './timeframes.js';
import { formatDatedTime } from './berlinTime.js';
import { orderBlockRecognitionTimes } from './orderBlockRecognitionTime.js';

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

/**
 * primary/opposingCandidates: B/C-Ergebnisse; target2: festgehaltenes P5 aus D.
 * h1Candles/m5Candles: vollständige markierte Rohpräfixe, keine sichtbaren Pickerlisten.
 * Kandidaten ohne gemeinsame Pivotidentität/Bewegungsbeleg bleiben ausdrücklich unzugeordnet.
 * Keine Alters-/Distanzfenster, Stärkeformel oder Mitigationsdefinition hinzufügen.
 */
export function evaluateChecklistConfluences({ evaluatedAt, direction, primary, opposingCandidates,
  target2, h1Candles, m5Candles, minGapByTimeframe = {} } = {}) {
  const antiConfluences = { status: 'unknown', details: [], sweepCandidates: [], obCandidates: [], divergences: unknown() };
  const confluences = { status: 'unknown', details: [], obCandidates: [], divergences: unknown() };
  const result = { antiConfluences, confluences };
  if (!Number.isFinite(evaluatedAt) || !['long', 'short'].includes(direction)) {
    antiConfluences.details.push('Bewertungszeitpunkt oder Hauptrichtung fehlt.');
    confluences.details.push('Bewertungszeitpunkt oder Hauptrichtung fehlt.');
    return result;
  }
  const short = direction === 'short';
  antiConfluences.divergences = selectDivergences(detectChecklistDivergences({ candles: h1Candles, timeframe: '1H', evaluatedAt }), short ? 'bullish' : 'bearish');
  confluences.divergences = selectDivergences(detectChecklistDivergences({ candles: m5Candles, timeframe: '5m', evaluatedAt }), short ? 'bearish' : 'bullish');
  const main = knownSnapshot(primary, evaluatedAt) && primary.direction === direction ? primary : null;
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
  antiConfluences.details.push(target ? `${antiConfluences.sweepCandidates.length} gegenläufige Sweeps am identischen P5-Pivot.` : 'P5-Target für die Zuordnung fehlt oder ist noch unbekannt.');
  if (!antiConfluences.sweepCandidates.length) antiConfluences.details.push(`${antiConfluences.obCandidates.length} gegenläufige OB-Kandidaten mit P5-Preisüberlappung; Ursprung der Gegenreaktion ungeklärt.`);
  antiConfluences.details.push('Stärkevergleich und OB-gegen-Sweep-Wertung sind offen; kein automatisches Go/No-Go.');
  if (!Array.isArray(opposingCandidates)) antiConfluences.details.push('Gegenläufige Sweep-Daten fehlen.');
  for (const candidate of antiConfluences.sweepCandidates) {
    antiConfluences.details.push(`Sweep bei ${candidate.sweep.level.price}: Levelalter ${(candidate.sweep.ageSeconds / 3600).toFixed(1)} Handelsstunden; älter als B: ${candidate.olderThanPrimary == null ? 'unbekannt' : candidate.olderThanPrimary ? 'ja' : 'nein'}; Stärke unbekannt.`);
  }
  confluences.details.push(`${confluences.obCandidates.length} OB-Kandidaten jenseits des Sweeps; Timeframe, gemeinsame Bewegung und Mitigationsbedingung offen.`);
  for (const [check, label] of [[antiConfluences, 'H1-Gegendivergenz'], [confluences, 'M5-Divergenz in Hauptrichtung']]) {
    check.details.push(check.divergences.status === 'unknown' ? `${label}: Daten fehlen oder Historie reicht nicht.`
      : `${label}: ${check.divergences.candidates.length} Kandidaten im geschlossenen Präfix; Setup-Zuordnung offen.`);
    for (const d of check.divergences.candidates.slice(-3)) {
      check.details.push(`${label}: ${d.fromPrice} → ${d.toPrice}; RSI ${d.fromRsi.toFixed(1)} → ${d.toRsi.toFixed(1)}; erkannt ${formatDatedTime(d.recognizedAt)} (Europe/Berlin).`);
    }
    if (obResults.some(r => r.status === 'unknown')) check.details.push('OB-Historie mindestens eines Timeframes fehlt oder reicht nicht.');
  }
  confluences.details.push('Fehlende optionale Zusatzargumente sind kein No-Go.');
  return result;
}
