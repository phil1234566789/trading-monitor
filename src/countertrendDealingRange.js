import { hasConfirmedChecklistAbc } from './tradeSetupChecklistGates.js';
import { formatDatedTime } from './berlinTime.js';

export const COUNTERTREND_STAGE_VERSION = 'countertrend-abcdef-v1';

export function evaluateCountertrendDealingRange(checklist, candidate) {
  const at = checklist.evaluatedAt, checks = candidate?.checks ?? {};
  const known = time => Number.isFinite(time) && time <= at;
  const result = {version:COUNTERTREND_STAGE_VERSION,model:'countertrend',evaluatedAt:at,
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
  const confirmed = {...result,status:'confirmed',reason:'validationOpen',details:['A bis E erfüllt; H1-Gegendivergenz noch nicht prüfbar.']};
  // Der bestehende Lifecycle bleibt die Quelle für das belegte Preisende.
  const validity = candidate.validity;
  if (validity?.state === 'ended' && ['invalidation','both'].includes(validity.reason) && known(validity.recognizedAt))
    return {...confirmed,status:'invalidated',reason:'priceInvalidation',details:['Preis hat die Invalidierung der DR erreicht.']};
  const anti = checks.antiConfluences;
  if (anti?.status === 'passed') return {...confirmed,status:'validated',reason:'noCounterDivergence',
    details:['A bis E erfüllt, keine H1-Gegendivergenz.']};
  if (anti?.status !== 'pending') return confirmed;
  const all = anti.divergences?.candidates ?? [];
  const showstoppers = all.filter(d=>known(d.recognizedAt));
  if (all.length && !showstoppers.length) return confirmed;
  const latest = showstoppers.at(-1);
  const detail = latest ? `H1-Gegendivergenz ${latest.type === 'bullish'?'bullisch':'bärisch'}${Number.isFinite(latest.fromTime)
    ? ` ab ${formatDatedTime(latest.fromTime)}`:''}; bestätigt ${formatDatedTime(latest.recognizedAt)}.` : 'H1-Gegendivergenz vorhanden.';
  return {...confirmed,status:'invalidated',reason:'h1CounterDivergence',details:[detail],fShowstoppers:showstoppers};
}
