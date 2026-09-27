import { collectStructureLqLevels } from './marketStructureRendering';
import { classifyAge } from './ageTier';
import { compareSweepAge, sweepAgeSec, detectSetupObs, deriveSetupEntryInvalidation } from './tradeSetup.js';
import { closedChecklistCandles } from './tradeSetupChecklistTimeBasis.js';
import { orderBlockRecognitionTimes } from './orderBlockRecognitionTime.js';

const check = (status, ...details) => ({ status, details });
const knownBound = (bound, at) => Number.isFinite(bound?.price) && Number.isFinite(bound?.knownAt) && bound.knownAt <= at;

/** Bounds are {price, knownAt}; candles use open timestamps. Target 2 never extends life. */
export function evaluateChecklistCandidateValidity({ candidate, candles = [], evaluatedAt, invalidation, target1 }) {
  const hasInvalidation = knownBound(invalidation, evaluatedAt);
  const hasTarget = knownBound(target1, evaluatedAt);
  const short = candidate.direction === 'short';
  const rows = closedChecklistCandles(candles, '5m', evaluatedAt);
  for (const candle of rows) {
    // Rollover-Dochte beenden auch in der bestehenden Setup-Erkennung keine Idee.
    if (candle.ignored || candle.time < candidate.sweep.level.touchedTime) continue;
    const invalid = hasInvalidation && candle.time >= invalidation.knownAt && (short ? candle.high >= invalidation.price : candle.low <= invalidation.price);
    const target = hasTarget && candle.time >= target1.knownAt && (short ? candle.low <= target1.price : candle.high >= target1.price);
    if (invalid || target) return { state: 'ended', reason: invalid && target ? 'both' : invalid ? 'invalidation' : 'target1', endedAt: candle.time, recognizedAt: candle.time + 300 };
  }
  // Für jedes Level muss auch der Zeitraum vor Bekanntwerden des anderen abgedeckt sein.
  // Ein Start innerhalb einer Kerze lässt deren vorherige/nachherige Extremfolge offen.
  const through = Math.floor(evaluatedAt / 300) * 300;
  const covered = bound => {
    const start = Math.max(bound.knownAt, candidate.sweep.level.touchedTime);
    const window = rows.filter(c => c.time >= start && c.time < through);
    return start % 300 === 0 && window.length > 0 && window[0].time === start
      && window.at(-1).time + 300 === through
      && window.every((c, i) => Number.isFinite(c.high) && Number.isFinite(c.low) && (i === 0 || c.time === window[i - 1].time + 300));
  };
  return { state: hasInvalidation && hasTarget && covered(invalidation) && covered(target1) ? 'active' : 'unknown', reason: null, endedAt: null };
}

/** context must be reconstructed as-of evaluatedAt, including H1 pivot confirmation.
 * reactionLinks: [{candidateId, obStartTime, recognizedAt, invalidation?: {price, knownAt}}].
 * A link asserts the same movement; no legacy delay/distance window is silently inherited.
 */
export function evaluateChecklistSweeps({ context, h1Levels, reactionLinks = [], targetsByCandidateId = {} }) {
  const { instrument, evaluatedAt, direction, h1State } = context;
  const candles = closedChecklistCandles(context.m5Candles, '5m', evaluatedAt);
  const levels = h1Levels ?? [...collectStructureLqLevels(h1State, 1), ...collectStructureLqLevels(h1State, -1)];
  const obs = detectSetupObs(candles);
  const confirmationTimes = orderBlockRecognitionTimes(candles, '5m');
  const byId = new Map();
  let hasUnspecifiedAge = false;
  for (const level of levels) {
    if (![1, -1].includes(level.dir) || !Number.isFinite(level.price) || !Number.isFinite(level.pivotTime) || !level.touched || !Number.isFinite(level.touchedTime) || level.touchedTime + 300 > evaluatedAt || level.pivotTime >= level.touchedTime) continue;
    if (Number.isFinite(level.recognizedAt) && level.recognizedAt > evaluatedAt) continue;
    const ageSeconds = sweepAgeSec(level);
    const ageTier = classifyAge(ageSeconds);
    if (ageTier === 'minor') { hasUnspecifiedAge = true; continue; }
    const candidateDirection = level.dir === 1 ? 'short' : 'long';
    const id = `${instrument}:1H:${candidateDirection}:${level.pivotTime}:${level.price}:${level.touchedTime}`;
    const candidate = { id, direction: candidateDirection, sweep: { level, timeframe: '1H', ageSeconds, ageTier },
      // Der Sammler verwirft die Bestätigungszeit. Ohne belegte Zeit bleibt sie unbekannt,
      // statt die historische Touchzeit fälschlich als damaligen Wissensstand auszugeben.
      recognizedAt: level.recognizedAt ?? null, knownAsOf: evaluatedAt,
      reactionOB: null, entryPrice: null, invalidation: null, bandRisk: null, reactionRecognizedAt: null };
    const possibleObs = obs.filter(ob => ob.dir === -level.dir && ob.startTime >= level.touchedTime);
    const link = reactionLinks.filter(l => l.candidateId === id && Number.isFinite(l.recognizedAt) && l.recognizedAt <= evaluatedAt)
      .sort((a, b) => a.recognizedAt - b.recognizedAt)
      .find(l => possibleObs.some(ob => ob.startTime === l.obStartTime) && l.recognizedAt >= confirmationTimes.get(l.obStartTime));
    if (link) {
      const ob = possibleObs.find(o => o.startTime === link.obStartTime);
      candidate.reactionOB = ob;
      candidate.entryPrice = deriveSetupEntryInvalidation({ dir: level.dir, obTop: ob.top, obBottom: ob.bottom }).setupEntry;
      candidate.reactionRecognizedAt = link.recognizedAt;
      if (knownBound(link.invalidation, evaluatedAt)) {
        candidate.invalidation = link.invalidation.price;
        candidate.bandRisk = Math.abs(candidate.invalidation - candidate.entryPrice);
      }
    }
    candidate.validity = evaluateChecklistCandidateValidity({ candidate, candles, evaluatedAt,
      invalidation: candidate.reactionOB ? link?.invalidation : null, target1: targetsByCandidateId[id] });
    candidate.checks = {
      liquiditySweep: check('passed', `H1 ${ageTier === 'major' ? 'Major' : 'Medium'} Sweep bei ${level.price}; Levelalter ${(ageSeconds / 3600).toFixed(1)} Handelsstunden.`),
      reaction: candidate.reactionOB
        ? check(candidate.bandRisk > 0 ? 'passed' : 'unknown',
          `${candidate.direction === 'short' ? 'Bärischer' : 'Bullischer'} M5-Orderblock zugeordnet; FVG-Stärke ${candidate.reactionOB.fvg} Preisabstand.`,
          candidate.bandRisk > 0 ? `Strukturelles Risikoband ${candidate.bandRisk} Preisabstand; Invalidierung ${candidate.invalidation}.` : 'Strukturelles Risikoband und Fixierung der Invalidierung noch offen.')
        : possibleObs.length ? check('unknown', 'M5-Orderblock vorhanden; Zuordnung zur selben Sweep-Bewegung noch ungeklärt.')
          : check('pending', 'Noch kein passender bestätigter M5-Orderblock nach diesem Sweep.'),
    };
    byId.set(id, candidate);
  }
  const candidates = [...byId.values()].sort((a, b) => compareSweepAge(a.sweep, b.sweep));
  const remaining = candidates.filter(c => c.validity.state !== 'ended');
  const primary = remaining.find(c => c.direction === direction) ?? null;
  const opposingCandidates = direction ? remaining.filter(c => c.direction !== direction) : [];
  const checks = primary?.checks ?? {
    liquiditySweep: check('unknown', !direction ? 'H1-Trendrichtung fehlt.' : hasUnspecifiedAge ? 'Nur jüngere Sweeps; deren Alterszulässigkeit ist noch offen.' : 'Kein noch unbeendeter Major-/Medium-H1-Sweep im bekannten Strukturstand.'),
    reaction: check('pending', 'Kein Hauptkandidat für die M5-Reaktion.'),
  };
  return { candidates, primary, opposingCandidates, checks };
}
