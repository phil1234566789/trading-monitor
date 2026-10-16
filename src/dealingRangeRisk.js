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
