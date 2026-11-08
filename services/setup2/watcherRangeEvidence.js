import {skipSpreadHourGaps} from '../../src/spreadHourGaps.js';
import {entryPattern1ConditionResults,isEntryPattern1} from '../../src/entryPattern1Conditions.js';
import {entryPattern2ConditionResults,isEntryPattern2} from '../../src/entryPattern2Conditions.js';

const checkpoints = [
 ['liquiditySweep','A · Liquidity Sweep'], ['reaction','B · Reaktion'],
 ['outerM5Trend','C · Äußerster M5-Trend'], ['m5Trend','D · Aktueller M5-Trend'],
 ['targets','E · Targets'], ['antiConfluences','F · Anti-Confluences']
];
const labels = {
 m5Countertrend:'M5-Countertrend', m5Bos:'M5-BOS', m5Choch:'M5-CHoCH',
 m1PivotBreak:'M1-Pivotbruch', m1Choch:'M1-CHoCH', m1Bos:'M1-BOS',
 retest:'M5-OB-Retest', retestOrderBlock:'Retest-Orderblock in Setup-Richtung',
 fvg:'Gleichgerichtete M1-FVG', fvgAfterRetest:'FVG nach Retest',retestedFvg:'Bekannte M1-FVG zum Retest',fvgRetest:'M1-FVG-Retest'
};

export function watcherRangeEvidence(snapshot, entry, latestM1) {
 const dr = snapshot.dealingRange;
 const lifecycle = snapshot.rangeCourse?.lifecycle;
 const checks = snapshot.checklist?.checks;
 const m1 = latestM1 ?? snapshot.m1Check;
 const conditions = m1?.conditions;
 const blockers = [...(dr?.fShowstoppers ?? []), ...(dr?.gShowstoppers ?? [])];
 let stage = dr?.status ?? 'unknown';
 if (stage === 'disqualified' && !blockers.some(fact => Number.isFinite(fact.recognizedAt) && fact.recognizedAt <= snapshot.knownAt)) stage = 'unknown';
 let step = null, missing = null;
 if (stage === 'validated' && lifecycle?.main?.state === 'ended') {
  step = 'Entry-Suche beendet';
 } else if (stage === 'validated' && lifecycle?.entrySearchAllowed === false) {
  step = 'Entry-Suche ohne belegte Freigabe';
 } else if (stage === 'validated') {
  step = 'H · Entry finden';
  if (snapshot.entryEligibility?.status === 'blocked') missing = snapshot.entryEligibility.details?.[0] ?? 'Handelszeit / Session / News gesperrt';
  else if ((isEntryPattern1(m1?.entryPattern)||isEntryPattern2(m1?.entryPattern)) && conditions && m1.status !== 'error') {
   const rules=isEntryPattern2(m1.entryPattern)?entryPattern2ConditionResults(conditions,snapshot.direction,m1.evaluatedAt)
    :entryPattern1ConditionResults(conditions,snapshot.direction,m1.evaluatedAt,m1.entryPattern);
   const rule = rules
    .find(rule => rule.required && !rule.passed && Object.hasOwn(conditions, rule.key)
      && (conditions[rule.key] === null || (['m1PivotBreak','m1Choch','m1Bos'].includes(rule.key)
       && Number.isFinite(conditions[rule.key]?.recognizedAt) && conditions[rule.key]?.type && conditions[rule.key]?.direction)));

   if (rule) missing = labels[rule.key] ?? null;
  }
 } else if (['unconfirmed','confirmed'].includes(stage)) {
  const checkpoint = checkpoints.find(([key]) => ['unmet','blocked'].includes(checks?.[key]?.status));
  if (checkpoint) {
   step = checkpoint[1];
   missing = checks[checkpoint[0]].details?.[0] ?? step;
  } else if (dr?.reason === 'targetsUnavailable') {
   step = 'E · Targets';
   missing = 'Keine zulässigen Targets bestimmbar';
  } else if (stage === 'confirmed') step = 'F/G · Validierung';
 }
 return {
  setupKey: snapshot.setupKey, direction: snapshot.direction, knownAt: Number.isFinite(m1?.evaluatedAt) ? Math.max(snapshot.knownAt, m1.evaluatedAt) : snapshot.knownAt,
  stage, step, missing, details: stage === 'unknown' ? [] : dr?.details ?? [],
  lifecycle: lifecycle?.main?.state ?? null, lifecycleReason: lifecycle?.main?.reason ?? null,
  technical: m1?.status === 'error' ? {at:m1.evaluatedAt, details:m1.details ?? []} : null,
  entry: entry ? {price:entry.price, recognizedAt:entry.recognizedAt} : null
 };
}

// Nur eine zwischen tatsächlich verarbeiteten Kerzen belegte Lücke darf als Pause erscheinen.
export function watcherMarketPause(candles, processed, previous) {
 if (!Number.isFinite(processed) || !candles.some(candle => candle.time === processed - 60)) return previous ?? null;
 const next = candles.find(candle => candle.time >= processed)?.time;
 if (!Number.isFinite(next) || next <= processed || skipSpreadHourGaps(processed, next, 60) !== next) return previous ?? null;
 return {reason:'scheduledMarketGap',from:new Date(processed * 1000).toISOString(),until:new Date(next * 1000).toISOString()};
}
