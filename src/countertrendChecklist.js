import { setup1RecognitionTime } from './setup1RecognitionTime.js';
import { evaluateCountertrendLifecycle } from './countertrendLifecycle.js';
import { evaluateChecklistM5, evaluateChecklistOuterM5, unknownChecklistM5 } from './tradeSetupChecklistM5.js';
import { closedChecklistCandles } from './tradeSetupChecklistTimeBasis.js';
import { markIgnoredCandles } from './sessionOccurrences.js';
import { berlinOffsetMinutes } from './berlinTime.js';
import { evaluateDealingRange, COUNTERTREND_STAGE_VERSION } from './tradeSetup2DealingRange.js';
import { fixChecklistTargets,CHECKLIST_RULE_VERSION } from './tradeSetupChecklistLifecycle.js';
import { evaluateChecklistConfluences } from './tradeSetupChecklistConfluences.js';
import { deriveSetupEntryInvalidation, sweepAgeSec } from './tradeSetup.js';
import { divergenceObservationRule, H1_COUNTER_DIVERGENCE_RULE, M5_SWEEP_DIVERGENCE_RULE, OBSERVATION_RULE_VERSION } from './checklistObservationRules.js';
import { ENTRY_PATTERN_1_VERSION } from './entryPattern1Conditions.js';
import { finalObservation,setupMemoKey } from './setup2Memo.js';

export { COUNTERTREND_STAGE_VERSION } from './tradeSetup2DealingRange.js';
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
  tradingWindows, news, newsLoadStatus, closeReactionCache, setupClassificationCache, setupMemo, detectScanOrderBlocks, dataRevision=0,entryOutcomes = new Map() } = {}) {
  const pending = () => ({ status: 'pending', details: ['Wartet auf ein bekanntes Setup 1.0.'] });
  const checks = { liquiditySweep: pending(), reaction: pending(), m5Trend: unknownChecklistM5(),
    outerM5Trend: { status: 'unknown', required: true, trend: 'unknown', details: ['Äußerster M5-Trend unbekannt.'] },
    targets: pending(), antiConfluences: {status:'unknown',details:['Wartet auf ein bekanntes Setup 1.0.'],
      ruleVersion:OBSERVATION_RULE_VERSION,rules:[divergenceObservationRule({...H1_COUNTER_DIVERGENCE_RULE,divergences:{status:'unknown'}})]}, confluences: { ...pending(), ruleVersion:OBSERVATION_RULE_VERSION,
      rules:[divergenceObservationRule({...M5_SWEEP_DIVERGENCE_RULE,divergences:{status:'unknown'}})] } };
  const result = { model: 'countertrend', entryPattern:ENTRY_PATTERN_1_VERSION,ruleVersion: COUNTERTREND_STAGE_VERSION, instrument, evaluatedAt,
    status: dataStatus, checks, direction: null, setupType: 'unclear', confirmed: false, abortReason: null,
    tradeability: 'unknown',
    setup: { candidates: [], primary: null, opposingCandidates: [], classifications: [] } };
  if (!Number.isFinite(evaluatedAt)) result.status = 'missing';
  const configs = sessionConfigs.filter(s => s.instrument === instrument);
  const mark = (rows, bar, at) => markIgnoredCandles(closedChecklistCandles(rows, bar, at), configs,
    sec => berlinOffsetMinutes(sec * 1000));
  const m5 = mark(m5Candles, '5m', evaluatedAt);
  result.context = { instrument, evaluatedAt, m5Candles: m5, h1Candles: mark(h1Candles, '1h', evaluatedAt), dailyAnchors,
    settings,tradingWindows,news,newsLoadStatus,sessionConfigs,dataRevision };
  if (result.status === 'ready' && !m5.length) result.status = 'missing';
  if (result.status === 'ready' && m5.at(-1).time + 300 < Math.floor(evaluatedAt / 300) * 300) result.status = 'stale';
  if (result.status !== 'ready') { result.dealingRange = evaluateDealingRange(result); return result; }
  for (const source of tradeSetups.filter(s=>s.instrument===instrument)) setup1RecognitionTime(source);
  const known = tradeSetups.filter(s => s.instrument === instrument && Number.isFinite(s.createdAt)
    && [1, -1].includes(s.dir) && [s.obTop, s.obBottom, s.obStartTime, s.ls?.price, s.ls?.pivotTime, s.ls?.touchedTime].every(Number.isFinite)
    && s.obTop > s.obBottom && setup1RecognitionTime(s) <= evaluatedAt
    && s.ls.pivotTime < s.ls.touchedTime && s.ls.touchedTime + 300 <= setup1RecognitionTime(s))
    .sort((a, b) => setup1RecognitionTime(b) - setup1RecognitionTime(a));
  const memoKeys=new Map();
  const candidates = known.map(source => {
    const direction = source.dir === 1 ? 'short' : 'long';
    const recognizedAt = setup1RecognitionTime(source);
    const anchor = dailyAnchors.filter(a => a.instrument == null || a.instrument === instrument)
      .filter(a => a.knownAt <= recognizedAt && Number.isFinite(a.structureStartTime))
      .sort((a, b) => b.pivotTime - a.pivotTime)[0];
    const memoKey=setupMemoKey(source,anchor,[COUNTERTREND_STAGE_VERSION,ENTRY_PATTERN_1_VERSION,
      CHECKLIST_RULE_VERSION,OBSERVATION_RULE_VERSION,settings],configs,dataRevision);
    memoKeys.set(source.tradeSetupId,memoKey);
    const memo=setupMemo?.get(memoKey);
    if(memo?.classificationFinal)return {...memo.candidate,knownAsOf:evaluatedAt,checks:{...memo.candidate.checks}};
    // Der kompakte Schlüssel kommt vor Markierung des Erkennungspräfixes.
    const cacheKey=memoKey;
    let evaluated = setupClassificationCache?.get(cacheKey);
    const context = { instrument, direction, evaluatedAt: recognizedAt,
      m5Candles: evaluated ? [] : mark(m5Candles, '5m', recognizedAt), closeReactionCache };
    // Ohne bekannten D1-P4-Anker bleibt C unbekannt; kein Lookback-/H1-Ersatz.
    if (!evaluated) {
      const outer = anchor ? evaluateChecklistOuterM5(context, settings, anchor.structureStartTime) : null;
      const expected = direction === 'short' ? 'downtrend' : 'uptrend';
      // C sperrt vor der D-Auswertung: keine Close-Reaktion/innerste Richtungsprüfung bei Gegenrichtung.
      const current = outer?.state.trend === expected
        ? evaluateChecklistM5(context, settings, anchor.structureStartTime, outer) : null;
      evaluated = { outer, current };
      if (setupClassificationCache && ['uptrend','downtrend'].includes(outer?.state.trend)
        && (!current || ['uptrend','downtrend'].includes(current.structureReaction?.trend))) {
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
    const candidate={ id: `${instrument}:setup1:${source.tradeSetupId}`, tradeSetupId: source.tradeSetupId, direction,
      setupType: classification.type, abortReason: classification.reason, knownAsOf: evaluatedAt,
      recognizedAt, reactionRecognizedAt: recognizedAt, checks: candidateChecks,
      sweep: { level: source.ls, timeframe: source.sweeps?.[0]?.timeframe ?? '5M', ageSeconds: sweepAgeSec(source.ls) },
      reactionOB: ob, reactionPreview: { ob, linked: true, candidateCount: 1, recognizedAt, assignedAt: recognizedAt },
      entryPrice: derived.setupEntry, invalidation: source.invalidation ?? derived.invalidation,
      validity: { state: 'unknown', reason: 'validationOpen' } };
    setupMemo?.set(memoKey,{candidate,classificationFinal:outerTrend!=='unknown' && (!outerPassed || currentTrend!=='unknown')});
    return candidate;
  });
  result.setup.classifications = candidates.map(c => ({ id: c.id, setupType: c.setupType, reason: c.abortReason,
    recognizedAt: c.recognizedAt, currentTrend: c.checks.m5Trend.trend, outerTrend: c.checks.outerM5Trend.trend }));
  const accepted = candidates.filter(c => c.setupType === 'countertrend');
  for (const candidate of accepted) {
    if(candidate.targetSelection?.status!=='passed')candidate.targetSelection = fixChecklistTargets({candidate,instrument,candles:m5,sessionConfigs,recognitionWithinBar:true,entryPattern:ENTRY_PATTERN_1_VERSION});
    candidate.checks.targets = candidate.targetSelection ?? {status:'unknown',details:['Zielprüfung offen.']};
    if (candidate.targetSelection?.status === 'passed') {
      const memo=setupMemo?.get(memoKeys.get(candidate.tradeSetupId));
      if(memo) memo.lifecycleProgress ??= {};
      candidate.lifecycle = evaluateCountertrendLifecycle({selection:candidate.targetSelection,invalidation:candidate.invalidation,
        candles:m5,evaluatedAt,entries:entryOutcomes.get(candidate.id) ?? [],progress:memo?.lifecycleProgress});
      candidate.validity = candidate.lifecycle.main;
      if(!finalObservation(candidate.checks.antiConfluences,'antiConfluences') || !finalObservation(candidate.checks.confluences,'confluences'))
      Object.assign(candidate.checks,evaluateChecklistConfluences({...result.context,evaluatedAt:candidate.recognizedAt,
        m5Candles:mark(m5Candles,'5m',candidate.recognizedAt),h1Candles:mark(h1Candles,'1h',candidate.recognizedAt),direction:candidate.direction,
        primary:{...candidate,knownAsOf:candidate.recognizedAt},opposingCandidates:[],target2:candidate.targetSelection.target2,
        frozen:candidate.checks,detectScanOrderBlocks}));
    }
  }
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
  result.setup.candidates = accepted;
  for (const candidate of accepted) if (evaluateDealingRange(result,candidate).status === 'validated')
    candidate.validatedAt=Math.max(candidate.recognizedAt,candidate.targetSelection.selectedAt);
  // Nur statische Ergebnisse behalten; Lifecycle und knownAsOf gehören zum jeweiligen Replay-Stand.
  if(setupMemo)for(const source of known){
    const candidate=candidates.find(c=>c.tradeSetupId===source.tradeSetupId);
    const key=memoKeys.get(source.tradeSetupId);
    const previous=setupMemo.get(key);
    if(previous)setupMemo.set(key,{...previous,candidate:{...candidate,checks:{...candidate.checks}}});
  }
  result.dealingRange = evaluateDealingRange(result);
  result.confirmed = ['confirmed','validated','disqualified'].includes(result.dealingRange.status);
  return result;
}
