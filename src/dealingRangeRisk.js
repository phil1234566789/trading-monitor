export const JOINT_LOSS_RISK_VERSION = 'joint-sl-loss-streak-v1';
export const JOINT_LOSS_INVALIDATION_DETAIL = 'Beide SL-Varianten der zwei aufeinanderfolgenden Entries haben verloren.';

export function knownJointLossInvalidation(state, asOf) {
  const risk = state?.riskInvalidation;
  return risk?.version === JOINT_LOSS_RISK_VERSION && Number.isFinite(risk.recognizedAt)
    && risk.recognizedAt <= asOf && Array.isArray(risk.entryIds)
    && risk.entryIds.length === 2 && risk.entryIds.every(id => typeof id === 'string' && id.length)
    && new Set(risk.entryIds).size === 2 ? risk : null;
}

export function savedRiskInvalidationLabel(state, asOf) {
  return (state?.reason ?? state?.main?.reason) === 'twoConsecutiveJointLosses'
    && knownJointLossInvalidation(state, asOf)
    ? 'DR risiko-invalidiert · zwei Verlust-Entries in Folge' : null;
}

// Beide SL-Varianten gehören zu einem Entry; ihre getrennten Serien wären eine andere Regel.
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
  const loss = entry => !entry.invalid && entry.variants.size === 2 && ['wide','narrow'].every(variant => {
    const outcome = entry.variants.get(variant);
    return outcome?.status === 'closed' && outcome.outcome === 'slBeforeT1'
      && Number.isFinite(outcome.pnlUsd) && outcome.pnlUsd < 0
      && Number.isFinite(outcome.exitRecognizedAt) && outcome.exitRecognizedAt > entry.time
      && outcome.exitRecognizedAt <= evaluatedAt && outcome.t1RecognizedAt == null;
  });
  const ordered = [...groups.values()].sort((a,b)=>a.time-b.time || a.id.localeCompare(b.id));
  let risk = null;
  for (let index = 1; index < ordered.length; index++) {
    const before = ordered[index-1], current = ordered[index];
    // Jeder andere Entry unterbricht; offene/unklare Varianten werden nicht übersprungen.
    if (before.time === current.time || !loss(before) || !loss(current)) continue;
    const recognizedAt = Math.max(...[...before.variants.values(),...current.variants.values()].map(e=>e.exitRecognizedAt));
    if (!risk || recognizedAt < risk.recognizedAt) risk = {version:JOINT_LOSS_RISK_VERSION,
      recognizedAt,entryIds:[before.id,current.id]};
  }
  return risk;
}
