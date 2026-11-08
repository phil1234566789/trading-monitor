import { setupSourceRecognitionTime,setupSourceId,setupSourceKey,isSweepRetestSource,assembleSetupSources } from './setupSources.js';
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
import {M1_FVG_RETEST_PATTERN_VERSION} from './m1FvgRetestSequence.js';
import {selectRelativeM5SweepRanges,relativeM5SweepKnownAt,RELATIVE_M5_SWEEP_RANGE_VERSION} from './relativeM5SweepRanges.js';
import {naturalSourceFamilyKey} from './setupSourceFamily.js';
import {knownSourceIdeaKey,SOURCE_IDEA_EXIT_POLICY} from './setupSourceIdeaIdentity.js';
import {evaluateSourceIdeaLifecycles} from './sourceIdeaLifecycle.js';

export { COUNTERTREND_STAGE_VERSION } from './tradeSetup2DealingRange.js';

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
  tradingWindows, news, newsLoadStatus, closeReactionCache, setupClassificationCache, setupMemo, detectScanOrderBlocks, dataRevision=0,entryOutcomes = new Map(),includeSweepRetestSources=false,sourcesAssembled=false,sourceIdeaBindings } = {}) {
  const pendingDetail=includeSweepRetestSources?'Wartet auf Setup 1.0 oder Liquidity Sweep mit M5-OB-Retest.':'Wartet auf ein bekanntes Setup 1.0.';
  const pending = () => ({ status: 'pending', details: [pendingDetail] });
  const checks = { liquiditySweep: pending(), reaction: pending(), m5Trend: unknownChecklistM5(),
    outerM5Trend: { status: 'unknown', required: true, trend: 'unknown', details: ['Äußerster M5-Trend unbekannt.'] },
    targets: pending(), antiConfluences: {status:'unknown',details:[pendingDetail],
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
  tradeSetups=assembleSetupSources({instrument,m5Candles:m5,h1Candles:result.context.h1Candles,evaluatedAt,
    tradeSetups,includeSweepRetestSources,sourcesAssembled,sessionConfigs});
  for (const source of tradeSetups.filter(s=>s.instrument===instrument)) setupSourceRecognitionTime(source);
  const known = tradeSetups.filter(s => s.instrument === instrument && Number.isFinite(s.createdAt)
    && [1, -1].includes(s.dir) && [s.obTop, s.obBottom, s.obStartTime, s.ls?.price, s.ls?.pivotTime, s.ls?.touchedTime].every(Number.isFinite)
    && s.obTop > s.obBottom && setupSourceRecognitionTime(s) <= evaluatedAt
    && s.ls.pivotTime < s.ls.touchedTime && s.ls.touchedTime + 300 <= setupSourceRecognitionTime(s))
    .sort((a, b) => setupSourceRecognitionTime(b) - setupSourceRecognitionTime(a));
  const memoKeys=new Map();
  const candidates = known.map(source => {
    const direction = source.dir === 1 ? 'short' : 'long';
    const recognizedAt = setupSourceRecognitionTime(source),sourceId=setupSourceId(source);
    const pattern=source.entryPattern ?? ENTRY_PATTERN_1_VERSION;
    const relativeSource=isSweepRetestSource(source);
    const classificationAt=relativeSource?(relativeM5SweepKnownAt(source) ?? recognizedAt):recognizedAt;
    const anchor = dailyAnchors.filter(a => a.instrument == null || a.instrument === instrument)
      .filter(a => a.knownAt <= classificationAt && Number.isFinite(a.structureStartTime))
      .sort((a, b) => b.pivotTime - a.pivotTime)[0];
    const memoKey=setupMemoKey(source,anchor,[COUNTERTREND_STAGE_VERSION,pattern,includeSweepRetestSources,
      relativeSource?RELATIVE_M5_SWEEP_RANGE_VERSION:null,
      CHECKLIST_RULE_VERSION,OBSERVATION_RULE_VERSION,settings],configs,dataRevision);
    memoKeys.set(sourceId,memoKey);
    const memo=setupMemo?.get(memoKey);
    if(memo?.classificationFinal)return {...memo.candidate,knownAsOf:evaluatedAt,checks:{...memo.candidate.checks}};
    // Der kompakte Schlüssel kommt vor Markierung des Erkennungspräfixes.
    const cacheKey=memoKey;
    let evaluated = setupClassificationCache?.get(cacheKey);
    const context = { instrument, direction, evaluatedAt: classificationAt,
      m5Candles: evaluated ? [] : mark(m5Candles, '5m', classificationAt), closeReactionCache };
    // Ohne bekannten D1-P4-Anker bleibt C unbekannt; kein Lookback-/H1-Ersatz.
    if (!evaluated) {
      const outer = anchor ? evaluateChecklistOuterM5(context, settings, anchor.structureStartTime) : null;
      const expected = direction === 'short' ? 'downtrend' : 'uptrend';
      // C sperrt vor der D-Auswertung: keine Close-Reaktion/innerste Richtungsprüfung bei Gegenrichtung.
      const current = (relativeSource&&outer?.state)||outer?.state?.trend === expected
        ? evaluateChecklistM5(context, settings, anchor.structureStartTime, outer) : null;
      const rangeAssociation=relativeSource?selectRelativeM5SweepRanges({source,state:outer?.state,
        reaction:current?.structureReaction,stateKnownAt:classificationAt,evaluatedAt:recognizedAt}):null;
      evaluated = { outer, current,rangeAssociation };
      if (setupClassificationCache && ['uptrend','downtrend'].includes(outer?.state?.trend)
        && (!current || ['uptrend','downtrend'].includes(current.structureReaction?.trend))) {
        if (setupClassificationCache.size >= 200) setupClassificationCache.delete(setupClassificationCache.keys().next().value);
        setupClassificationCache.set(cacheKey, evaluated);
      }
    }
    const { outer, current,rangeAssociation } = evaluated;
    const associated=rangeAssociation?.status==='ready';
    const currentTrend = relativeSource?(associated?rangeAssociation.inner.trend:'unknown'):current?.structureReaction?.trend ?? 'unknown';
    const outerTrend = relativeSource?(associated?rangeAssociation.outer.trend:'unknown'):outer?.state.trend ?? 'unknown';
    const outerState=relativeSource?rangeAssociation?.outer?.state:outer?.state;
    const outerPassed = outerTrend === (direction === 'short' ? 'downtrend' : 'uptrend');
    const classification = classifyM5SetupType(direction, currentTrend, outerTrend);
    const candidateChecks = {
      liquiditySweep: { status: 'passed', details: [isSweepRetestSource(source)?'Liquidity Sweep mit Retest eines vorhandenen M5-OB.':'Liquidity Sweep aus erkanntem Setup 1.0.'] },
      reaction: { status: 'passed', details: [isSweepRetestSource(source)?'Bereits bekannter M5-Orderblock nach Sweep geretestet.':'Zugehöriger M5-Orderblock aus Setup 1.0.'] },
      m5Trend: { ...current, trend: currentTrend, evaluatedAt: classificationAt,
        status: !outerPassed ? 'pending' : currentTrend === 'unknown' ? 'unknown' : classification.type === 'countertrend' ? 'passed' : 'unmet',
        details: relativeSource?[associated?`Zum Sweep führende M5-Range ${currentTrend==='uptrend'?'bullisch':'bärisch'} · quellengebunden bekannt.`:'M5-Range zum Sweep nicht eindeutig kausal zugeordnet.']:current ? [`Aktueller M5-Trend ${currentTrend === 'uptrend' ? 'bullisch' : currentTrend === 'downtrend' ? 'bärisch' : 'unbekannt'}.`]
          : ['D nicht ausgewertet: C nicht erfüllt.'],
        detailStatuses: [!outerPassed ? 'pending' : currentTrend === 'unknown' ? 'unknown' : classification.type === 'countertrend' ? 'passed' : 'unmet'] },
      outerM5Trend: { status: outerTrend === 'unknown' ? 'unknown' : outerPassed ? 'passed' : 'unmet', required: true,
        trend: outerTrend, evaluatedAt: classificationAt, structureState: outerState ?? null,
        structureStart: anchor?.structureStartTime ?? null, currRange: outerState?.currRange ?? null,
        details: [`${relativeSource?'Umschließender, den Sweep-Pivot enthaltender':'Äußerster'} M5-Trend ${outerTrend === 'uptrend' ? 'bullisch' : outerTrend === 'downtrend' ? 'bärisch' : 'unbekannt'}.`] },
    };
    const derived = deriveSetupEntryInvalidation({ dir: source.dir, obTop: source.obTop, obBottom: source.obBottom });
    const ob = { dir: -source.dir, top: source.obTop, bottom: source.obBottom, startTime: source.obStartTime, fvg: source.obFvg,
      ...(isSweepRetestSource(source)?{recognizedAt:source.orderBlockKnownAt}: {}) };
    const candidate={ id: setupSourceKey(source), tradeSetupId: source.tradeSetupId, sourceId,
      entryPattern:pattern,sourceKind:source.sourceKind,sourceRetest:source.sourceRetest,direction,
      ...(relativeSource?{rangeAssociation:associated?{version:rangeAssociation.version,status:'ready',sweep:rangeAssociation.sweep,
        outer:{trend:rangeAssociation.outer.trend,depth:rangeAssociation.outer.depth,range:rangeAssociation.outer.range,knownAt:rangeAssociation.outer.knownAt},
        inner:{trend:rangeAssociation.inner.trend,rawTrend:rangeAssociation.inner.rawTrend,depth:rangeAssociation.inner.depth,range:rangeAssociation.inner.range,
          basis:rangeAssociation.inner.basis,knownAt:rangeAssociation.inner.knownAt,confirmation:rangeAssociation.inner.confirmation}}
        :{version:RELATIVE_M5_SWEEP_RANGE_VERSION,status:'unknown',reason:rangeAssociation?.reason ?? 'sourceContextUnknown'}}:{}),
      ...(includeSweepRetestSources?{instrument,sourceFamilyKey:naturalSourceFamilyKey(source),exitPolicy:SOURCE_IDEA_EXIT_POLICY,
        entryPatterns:isSweepRetestSource(source)?[M1_FVG_RETEST_PATTERN_VERSION]:[ENTRY_PATTERN_1_VERSION,M1_FVG_RETEST_PATTERN_VERSION]}:{}),
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
  let accepted = candidates.filter(c => c.setupType === 'countertrend');
  for (const candidate of accepted) {
    if(candidate.targetSelection?.status!=='passed')candidate.targetSelection = fixChecklistTargets({candidate,instrument,candles:m5,sessionConfigs,recognitionWithinBar:true,entryPattern:ENTRY_PATTERN_1_VERSION});
    candidate.checks.targets = candidate.targetSelection ?? {status:'unknown',details:['Zielprüfung offen.']};
    if (candidate.targetSelection?.status === 'passed') {
      const memo=setupMemo?.get(memoKeys.get(candidate.sourceId));
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
  if(includeSweepRetestSources)accepted=evaluateSourceIdeaLifecycles(accepted,{evaluatedAt,
    bindings:sourceIdeaBindings??new Map(),signature:knownSourceIdeaKey,outcomes:entryOutcomes,
    evaluateLifecycle:evaluateCountertrendLifecycle,candles:m5});
  const selected = accepted[0] ?? candidates[0];
  if (selected) {
    result.direction = selected.direction;
    result.entryPattern=selected.entryPattern;
    result.entryPatterns=selected.entryPatterns;
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
    const candidate=candidates.find(c=>c.sourceId===setupSourceId(source));
    const key=memoKeys.get(setupSourceId(source));
    const previous=setupMemo.get(key);
    if(previous)setupMemo.set(key,{...previous,candidate:{...candidate,checks:{...candidate.checks}}});
  }
  result.dealingRange = evaluateDealingRange(result);
  result.confirmed = ['confirmed','validated','disqualified'].includes(result.dealingRange.status);
  return result;
}
