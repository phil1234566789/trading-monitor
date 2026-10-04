import {snapshotStructureLevels} from './tradeSetup2SnapshotIndicators.js';

export function snapshotDetailEvidence(snapshot, asOf) {
  const sources=[snapshot,...snapshot.entrySnapshots ?? []].filter(s=>s.knownAt<=asOf);
  const evidence=new Map();
  for(const source of sources) {
    for(const e of [...source.evidence ?? [],...snapshotStructureLevels(source)]) {
      if(e.knownAt>asOf)continue;
      // Re-Entries verlängern dieselben Zonen/Levels; Diagonalen behalten beide Endpunkte.
      const key=JSON.stringify([e.kind,e.role,e.ruleId,e.timeframe,e.fromTime,e.price,e.top,e.bottom,
        e.fromPrice,e.toPrice,e.kind==='segment'?e.toTime:null]);
      evidence.set(key,e);
    }
    const primary=source.checklist?.setup?.primary;
    const price=source.rangeCourse?.invalidation ?? primary?.invalidation;
    const knownAt=source.rangeCourse?.validatedAt ?? primary?.reactionRecognizedAt;
    if(Number.isFinite(price)&&Number.isFinite(knownAt)&&knownAt<=asOf) {
      evidence.set('invalidation',{kind:'line',role:'invalidation',timeframe:'5m',knownAt,price,
        fromTime:knownAt,toTime:Math.max(knownAt,Math.min(asOf,source.rangeCourse?.lifecycle?.evaluatedAt ?? asOf)-60),
        styleKey:'tradeLoss',label:'DR-Invalidierung'});
    }
  }
  return [...evidence.values()];
}
