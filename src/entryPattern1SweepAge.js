export const ENTRY_PATTERN_1_SWEEP_AGE_POLICY=Object.freeze({version:'p1-sweep-level-business-age-4h-v1',
  minimumAgeSeconds:Object.freeze({GBPUSD:4*3600,XAUUSD:4*3600})});
export const entryPattern1SweepAgeLabel=rule=>rule.minimumAgeSeconds===null?'Sweepalter · kein Mindestalter für dieses Instrument'
  :`Sweep-Level mindestens ${rule.minimumAgeSeconds/3600} Stunden alt · nur Pattern 1`;

export function entryPattern1SweepAgeRule(instrument,candidate,evaluatedAt) {
  const minimumAgeSeconds=ENTRY_PATTERN_1_SWEEP_AGE_POLICY.minimumAgeSeconds[instrument] ?? null;
  const ageSeconds=candidate?.sweep?.ageSeconds;
  const recognizedAt=candidate?.recognizedAt ?? candidate?.reactionRecognizedAt;
  const known=Number.isFinite(ageSeconds)&&ageSeconds>=0&&Number.isFinite(recognizedAt)&&recognizedAt<=evaluatedAt;
  return {version:ENTRY_PATTERN_1_SWEEP_AGE_POLICY.version,status:minimumAgeSeconds===null?'passed':!known?'unknown':ageSeconds<minimumAgeSeconds?'blocked':'passed',
    recognizedAt:minimumAgeSeconds===null?evaluatedAt:recognizedAt,minimumAgeSeconds,ageSeconds:known?ageSeconds:null};
}

// Alte Snapshots haben diesen H-Beleg nicht; ihre archivierte Freigabe wird nicht neu ausgelegt.
export const entryPattern1SweepAgePassed=(conditions,at)=>!Object.hasOwn(conditions ?? {},'sweepAge')
  ||conditions.sweepAge?.version===ENTRY_PATTERN_1_SWEEP_AGE_POLICY.version&&conditions.sweepAge.status==='passed'
    &&(conditions.sweepAge.minimumAgeSeconds===null
      ||Number.isFinite(conditions.sweepAge.recognizedAt)&&conditions.sweepAge.recognizedAt<=at);
