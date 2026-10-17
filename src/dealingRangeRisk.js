export const JOINT_LOSS_RISK_VERSION = 'joint-sl-loss-streak-v2';
export const JOINT_LOSS_INVALIDATION_DETAIL = 'Die weite SL-Variante der zwei aufeinanderfolgenden Entries hat bestätigt verloren.';

export const jointLossInvalidationDetail = risk => risk?.version === 'joint-sl-loss-streak-v1'
  ? 'Beide SL-Varianten der zwei aufeinanderfolgenden Entries haben verloren.' : JOINT_LOSS_INVALIDATION_DETAIL;

export function knownJointLossInvalidation(state, asOf) {
  const risk = state?.riskInvalidation;
  return [JOINT_LOSS_RISK_VERSION,'joint-sl-loss-streak-v1'].includes(risk?.version) && Number.isFinite(risk.recognizedAt)
    && risk.recognizedAt <= asOf && Array.isArray(risk.entryIds)
    && risk.entryIds.length === 2 && risk.entryIds.every(id => typeof id === 'string' && id.length)
    && new Set(risk.entryIds).size === 2 ? risk : null;
}

export function savedRiskInvalidationLabel(state, asOf) {
  return (state?.reason ?? state?.main?.reason) === 'twoConsecutiveJointLosses'
    && knownJointLossInvalidation(state, asOf)
    ? 'DR risiko-invalidiert · zwei Verlust-Entries in Folge' : null;
}

// Der bestätigte weite SL-Loss genügt; ein unbekannter enger Ausgang wird nicht umgeschrieben.
export function evaluateJointLossRisk(entries, evaluatedAt) {
  if (!Number.isFinite(evaluatedAt)) return null;
  const groups = new Map();
  for (const outcome of entries) {
    if (!outcome.entryId || !Number.isFinite(outcome.entryTime)) return null;
    if (outcome.entryTime > evaluatedAt) continue;
    let entry = groups.get(outcome.entryId);
    if (!entry) { entry = {id:outcome.entryId,time:outcome.entryTime,variants:new Map(),invalid:false}; groups.set(entry.id,entry); }
    if (entry.time !== outcome.entryTime || entry.variants.has(outcome.variant)) entry.invalid = true;
    entry.variants.set(outcome.variant,outcome);
  }
  const loss = entry => {
    if (entry.invalid || entry.variants.size !== 2) return false;
    const wide = entry.variants.get('wide'), narrow = entry.variants.get('narrow');
    if (!narrow || narrow.status === 'notExecutable') return false;
    return wide?.status === 'closed' && wide.outcome === 'slBeforeT1'
      && Number.isFinite(wide.pnlUsd) && wide.pnlUsd < 0
      && Number.isFinite(wide.exitRecognizedAt) && wide.exitRecognizedAt > entry.time
      && wide.exitRecognizedAt <= evaluatedAt && wide.t1RecognizedAt == null;
  };
  const ordered = [...groups.values()].sort((a,b)=>a.time-b.time || a.id.localeCompare(b.id));
  let risk = null;
  for (let index = 1; index < ordered.length; index++) {
    const before = ordered[index-1], current = ordered[index];
    // Jeder Entry ohne bestätigten weiten Verlust unterbricht; Zwischenentries werden nicht übersprungen.
    if (before.time === current.time || !loss(before) || !loss(current)) continue;
    const recognizedAt = Math.max(before.variants.get('wide').exitRecognizedAt,current.variants.get('wide').exitRecognizedAt);
    // Spätere enge Gewinne dürfen einen zuvor bekannten Risikoabschluss nicht rückwirkend löschen.
    if ([before,current].some(entry=>{
      const narrow=entry.variants.get('narrow');
      return Number.isFinite(narrow.t1RecognizedAt) && narrow.t1RecognizedAt<=recognizedAt
        || narrow.status==='closed' && Number.isFinite(narrow.exitRecognizedAt) && narrow.exitRecognizedAt<=recognizedAt
        && (narrow.outcome!=='slBeforeT1' || !(narrow.pnlUsd<0));
    })) continue;
    if (!risk || recognizedAt < risk.recognizedAt) risk = {version:JOINT_LOSS_RISK_VERSION,
      recognizedAt,entryIds:[before.id,current.id]};
  }
  return risk;
}
