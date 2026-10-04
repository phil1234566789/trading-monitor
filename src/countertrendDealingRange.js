import { hasConfirmedChecklistAbc } from './tradeSetupChecklistGates.js';
import { formatDatedTime } from './berlinTime.js';
import { antiConfluenceStatus, checklistObservationRules, summarizeAntiConfluenceRules } from './checklistObservationRules.js';

export const COUNTERTREND_STAGE_VERSION = 'countertrend-abcdef-v2';

export function evaluateCountertrendDealingRange(checklist, candidate) {
  const at = checklist.evaluatedAt, checks = candidate?.checks ?? {};
  const known = time => Number.isFinite(time) && time <= at;
  const version = checklist.ruleVersion === 'countertrend-abcdef-v1' ? checklist.ruleVersion : COUNTERTREND_STAGE_VERSION;
  const result = {version,model:'countertrend',evaluatedAt:at,
    status:'unconfirmed',reason:candidate?.abortReason ?? 'abcdIncomplete',
    details:[candidate?.abortReason ?? 'A bis D noch nicht vollständig erfüllt.'],eShowstoppers:[],fShowstoppers:[]};
  if (checklist.status !== 'ready' || !Number.isFinite(at) || candidate?.setupType !== 'countertrend'
    || !['short','long'].includes(candidate.direction) || !known(candidate.reactionRecognizedAt)
    || !hasConfirmedChecklistAbc(checks) || checks.m5Trend?.status !== 'passed') return result;
  const selection = candidate.targetSelection;
  const selected = known(selection?.selectedAt);
  const targets = selected && selection.status === 'passed' && Number.isFinite(selection.target1?.price)
    && (!Number.isFinite(selection.target1.knownAt) || selection.target1.knownAt <= selection.selectedAt);
  if (!targets) {
    const missing = selected && ['pending','unmet'].includes(selection.status);
    return {...result,reason:missing?'targetsUnavailable':'targetsUnchecked',details:[missing?'Targets nicht bestimmbar.':'Zielprüfung offen.']};
  }
  const confirmed = {...result,status:'confirmed',reason:'validationOpen',details:['A bis E erfüllt; Anti-Confluence-Prüfung noch offen.']};
  // Nur die historische v1 machte aus einem Preisende eine DR-Stufe.
  const validity = candidate.validity;
  if (version === 'countertrend-abcdef-v1' && validity?.state === 'ended' && ['invalidation','both'].includes(validity.reason) && known(validity.recognizedAt))
    return {...confirmed,status:'invalidated',reason:'priceInvalidation',details:['Preis hat die Invalidierung der DR erreicht.']};
  const anti = checks.antiConfluences;
  const antiStatus = antiConfluenceStatus(anti, at);
  const g = checks.confluences;
  const gStatus = version === COUNTERTREND_STAGE_VERSION && Array.isArray(g?.rules)
    ? summarizeAntiConfluenceRules(g.rules, at, g.ruleVersion) : 'clear';
  if (antiStatus === 'clear' && gStatus === 'clear') return {...confirmed,status:'validated',reason:'noCounterDivergence',
    details:['A bis E erfüllt, kein eingeschalteter Anti-Confluence-Showstopper.']};
  if (antiStatus !== 'found' && gStatus !== 'found') return confirmed;
  const fRules = checklistObservationRules(anti, 'antiConfluences').filter(r => summarizeAntiConfluenceRules([r], at, anti?.ruleVersion) === 'found');
  const gRules = gStatus === 'found' ? g.rules.filter(r => summarizeAntiConfluenceRules([r], at, g.ruleVersion) === 'found') : [];
  const foundRules = [...fRules, ...gRules];
  const all = foundRules.flatMap(r => r.evidence ?? []);
  const showstoppers = all.filter(d=>known(d.recognizedAt));
  const latest = showstoppers.at(-1);
  const detail = latest && foundRules.every(r => r.id === 'h1CounterDivergence') ? `H1-Gegendivergenz ${latest.type === 'bullish'?'bullisch':'bärisch'}${Number.isFinite(latest.fromTime)
    ? ` ab ${formatDatedTime(latest.fromTime)}`:''}; bestätigt ${formatDatedTime(latest.recognizedAt)}.` : foundRules.map(r => r.label).join('; ');
  return {...confirmed,status:version === 'countertrend-abcdef-v1' ? 'invalidated' : 'disqualified',reason:foundRules.every(r => r.id === 'h1CounterDivergence') ? 'h1CounterDivergence' : 'antiConfluence',
    details:[detail],fShowstoppers:fRules.flatMap(r => r.evidence ?? []).filter(d => known(d.recognizedAt)),
    ...(version === COUNTERTREND_STAGE_VERSION ? {gShowstoppers:gRules.flatMap(r => r.evidence ?? []).filter(d => known(d.recognizedAt))} : {})};
}
