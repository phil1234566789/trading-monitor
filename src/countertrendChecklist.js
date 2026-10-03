import { evaluateChecklistM5, evaluateChecklistOuterM5, unknownChecklistM5 } from './tradeSetupChecklistM5.js';
import { evaluateChecklistTime } from './tradeSetupChecklistTime.js';
import { closedChecklistCandles } from './tradeSetupChecklistTimeBasis.js';
import { markIgnoredCandles } from './sessionOccurrences.js';
import { berlinOffsetMinutes } from './berlinTime.js';
import { evaluateDealingRange, COUNTERTREND_VERSION } from './tradeSetup2DealingRange.js';
import { deriveSetupEntryInvalidation, sweepAgeSec } from './tradeSetup.js';

export { COUNTERTREND_VERSION } from './tradeSetup2DealingRange.js';
export const SETUP_TYPE_LABELS = { trendContinuation: 'Trendfortführung', countertrend: 'Countertrend', unclear: 'Unklar' };

export function classifyM5SetupType(direction, currentTrend, outerTrend) {
  const expected = direction === 'long' ? 'uptrend' : direction === 'short' ? 'downtrend' : null;
  if (!expected || !['uptrend', 'downtrend'].includes(outerTrend))
    return { type: 'unclear', reason: 'M5-Trend unbekannt' };
  if (outerTrend !== expected) return { type: 'unclear', reason: 'äußerster M5-Trend gegen Setup-Richtung' };
  if (!['uptrend', 'downtrend'].includes(currentTrend)) return { type: 'unclear', reason: 'M5-Trend unbekannt' };
  if (currentTrend === expected) return { type: 'trendContinuation', reason: 'Typ Trendfortführung, noch nicht umgesetzt' };
  return { type: 'countertrend', reason: null };
}

export function evaluateCountertrendChecklist({ instrument, evaluatedAt, m5Candles = [], h1Candles = [],
  tradeSetups = [], dailyAnchors = [], settings = {}, sessionConfigs = [], dataStatus = 'ready',
  tradingWindows, news, newsLoadStatus, closeReactionCache, setupClassificationCache } = {}) {
  const pending = () => ({ status: 'pending', details: ['Wartet auf ein bekanntes Setup 1.0.'] });
  const checks = { liquiditySweep: pending(), reaction: pending(), m5Trend: unknownChecklistM5(),
    outerM5Trend: { status: 'unknown', required: true, trend: 'unknown', details: ['Äußerster M5-Trend unbekannt.'] },
    targets: pending(), antiConfluences: pending(), confluences: pending(),
    time: evaluateChecklistTime({ instrument, evaluatedAt, sessions: sessionConfigs, tradingWindows, news, newsLoadStatus }) };
  const result = { model: 'countertrend', ruleVersion: COUNTERTREND_VERSION, instrument, evaluatedAt,
    status: dataStatus, checks, direction: null, setupType: 'unclear', confirmed: false, abortReason: null,
    tradeability: checks.time.outsideTradingHours ? 'blocked' : 'unknown',
    setup: { candidates: [], primary: null, opposingCandidates: [], classifications: [] } };
  if (!Number.isFinite(evaluatedAt)) result.status = 'missing';
  const configs = sessionConfigs.filter(s => s.instrument === instrument);
  const mark = (rows, bar, at) => markIgnoredCandles(closedChecklistCandles(rows, bar, at), configs,
    sec => berlinOffsetMinutes(sec * 1000));
  const m5 = mark(m5Candles, '5m', evaluatedAt);
  result.context = { instrument, evaluatedAt, m5Candles: m5, h1Candles: mark(h1Candles, '1h', evaluatedAt), dailyAnchors };
  if (result.status === 'ready' && !m5.length) result.status = 'missing';
  if (result.status === 'ready' && m5.at(-1).time + 300 < Math.floor(evaluatedAt / 300) * 300) result.status = 'stale';
  if (result.status !== 'ready') { result.dealingRange = evaluateDealingRange(result); return result; }
  const known = tradeSetups.filter(s => s.instrument === instrument && Number.isFinite(s.createdAt)
    && [1, -1].includes(s.dir) && [s.obTop, s.obBottom, s.obStartTime, s.ls?.price, s.ls?.pivotTime, s.ls?.touchedTime].every(Number.isFinite)
    && s.obTop > s.obBottom && s.createdAt <= evaluatedAt && s.createdAt >= s.obStartTime + 300
    && s.ls.pivotTime < s.ls.touchedTime && s.ls.touchedTime + 300 <= s.createdAt)
    .sort((a, b) => b.createdAt - a.createdAt);
  const candidates = known.map(source => {
    const direction = source.dir === 1 ? 'short' : 'long';
    const recognizedAt = source.createdAt;
    const anchor = dailyAnchors.filter(a => a.instrument == null || a.instrument === instrument)
      .filter(a => a.knownAt <= recognizedAt && Number.isFinite(a.structureStartTime))
      .sort((a, b) => b.pivotTime - a.pivotTime)[0];
    const context = { instrument, direction, evaluatedAt: recognizedAt,
      m5Candles: mark(m5Candles, '5m', recognizedAt), closeReactionCache };
    // Ohne bekannten D1-P4-Anker bleibt C unbekannt; kein Lookback-/H1-Ersatz.
    const cacheKey = JSON.stringify([source.tradeSetupId, recognizedAt, anchor?.structureStartTime,
      settings.m5StructurePeriod ?? 5, settings.m5Structure2Period ?? 2, context.m5Candles]);
    let evaluated = setupClassificationCache?.get(cacheKey);
    if (!evaluated) {
      const outer = anchor ? evaluateChecklistOuterM5(context, settings, anchor.structureStartTime) : null;
      const expected = direction === 'short' ? 'downtrend' : 'uptrend';
      // C sperrt vor der D-Auswertung: keine Close-Reaktion/innerste Richtungsprüfung bei Gegenrichtung.
      const current = outer?.state.trend === expected
        ? evaluateChecklistM5(context, settings, anchor.structureStartTime, outer) : null;
      evaluated = { outer, current };
      if (setupClassificationCache) {
        if (setupClassificationCache.size >= 200) setupClassificationCache.delete(setupClassificationCache.keys().next().value);
        setupClassificationCache.set(cacheKey, evaluated);
      }
    }
    const { outer, current } = evaluated;
    const currentTrend = current?.structureReaction?.trend ?? 'unknown';
    const outerTrend = outer?.state.trend ?? 'unknown';
    const outerPassed = outerTrend === (direction === 'short' ? 'downtrend' : 'uptrend');
    const classification = classifyM5SetupType(direction, currentTrend, outerTrend);
    const candidateChecks = {
      liquiditySweep: { status: 'passed', details: ['Liquidity Sweep aus erkanntem Setup 1.0.'] },
      reaction: { status: 'passed', details: ['Zugehöriger M5-Orderblock aus Setup 1.0.'] },
      m5Trend: { ...current, trend: currentTrend, evaluatedAt: recognizedAt,
        status: !outerPassed ? 'pending' : currentTrend === 'unknown' ? 'unknown' : classification.type === 'countertrend' ? 'passed' : 'unmet',
        details: current ? [`Aktueller M5-Trend ${currentTrend === 'uptrend' ? 'bullisch' : currentTrend === 'downtrend' ? 'bärisch' : 'unbekannt'}.`]
          : ['D nicht ausgewertet: C nicht erfüllt.'],
        detailStatuses: [!outerPassed ? 'pending' : currentTrend === 'unknown' ? 'unknown' : classification.type === 'countertrend' ? 'passed' : 'unmet'] },
      outerM5Trend: { status: outerTrend === 'unknown' ? 'unknown' : outerPassed ? 'passed' : 'unmet', required: true,
        trend: outerTrend, evaluatedAt: recognizedAt, structureState: outer?.state ?? null,
        structureStart: anchor?.structureStartTime ?? null, currRange: outer?.state.currRange ?? null,
        details: [`Äußerster M5-Trend ${outerTrend === 'uptrend' ? 'bullisch' : outerTrend === 'downtrend' ? 'bärisch' : 'unbekannt'}.`] },
    };
    const derived = deriveSetupEntryInvalidation({ dir: source.dir, obTop: source.obTop, obBottom: source.obBottom });
    const ob = { dir: -source.dir, top: source.obTop, bottom: source.obBottom, startTime: source.obStartTime, fvg: source.obFvg };
    return { id: `${instrument}:setup1:${source.tradeSetupId}`, tradeSetupId: source.tradeSetupId, direction,
      setupType: classification.type, abortReason: classification.reason, knownAsOf: evaluatedAt,
      recognizedAt, reactionRecognizedAt: recognizedAt, checks: candidateChecks,
      sweep: { level: source.ls, timeframe: source.sweeps?.[0]?.timeframe ?? '5M', ageSeconds: sweepAgeSec(source.ls) },
      reactionOB: ob, reactionPreview: { ob, linked: true, candidateCount: 1, recognizedAt, assignedAt: recognizedAt },
      entryPrice: derived.setupEntry, invalidation: source.invalidation ?? derived.invalidation,
      validity: { state: 'unknown', reason: 'validationOpen' } };
  });
  result.setup.classifications = candidates.map(c => ({ id: c.id, setupType: c.setupType, reason: c.abortReason,
    recognizedAt: c.recognizedAt, currentTrend: c.checks.m5Trend.trend, outerTrend: c.checks.outerM5Trend.trend }));
  const accepted = candidates.filter(c => c.setupType === 'countertrend');
  const selected = accepted[0] ?? candidates[0];
  if (selected) {
    result.direction = selected.direction;
    result.setupType = selected.setupType;
    result.abortReason = selected.abortReason;
    Object.assign(checks, selected.checks);
    result.structure = selected.checks.m5Trend.structureState ?? null;
    result.context.direction = selected.direction;
    result.setup.primary = selected;
  }
  // E ff. sind noch offen; weder alte Targets noch Entry-Regeln entscheiden die neue DR-Stufe.
  result.setup.candidates = accepted;
  result.dealingRange = evaluateDealingRange(result);
  result.confirmed = result.dealingRange.status === 'confirmed';
  return result;
}
