import { tradeSetup2Evidence } from './tradeSetup2Evidence.js';

export function isTradeSetup2SnapshotView(props) {
  return !!(props.tradeSetup2RunId && props.selectedTradeSetup2Id);
}

// Bereits gespeicherte v1-Stände enthalten noch zeitlose Farbkeys und M1 ohne
// Instrument. Die Darstellung ergänzt das, ohne den historischen Datensatz zu ändern.
export function restoreTradeSetup2Snapshot(snapshot) {
  if (!snapshot) return null;
  return {...snapshot,m1Check:snapshot.m1Check?{...snapshot.m1Check,instrument:snapshot.instrument}:null,
    evidence:(snapshot.evidence ?? []).map(e=>{
      const suffix=e.timeframe==='1h'?'1h':e.timeframe==='4h'?'4h':'M5';
      const aliases={liquidityLow:`liquidityLow${suffix}`,liquidityHigh:`liquidityHigh${suffix}`,
        liquiditySweep:`liquiditySweep${suffix}`,obBull:`obBull${suffix}`,obBear:`obBear${suffix}`,
        confirmation:'tradeConfirmation',confluence:'tradeConfirmation'};
      return {...e,styleKey:aliases[e.styleKey] ?? e.styleKey};
    })};
}

export function buildTradeSetup2CandidateSnapshot({checklist,candidate}) {
  if (checklist?.status!=='ready' || !candidate?.id || !Number.isFinite(candidate.knownAsOf)
    || candidate.knownAsOf!==checklist.evaluatedAt) return null;
  const state={...checklist,setup:{primary:candidate}};
  delete state.context;
  // Bei Gegenkandidaten gehören H/G nicht zu dieser Idee. Nur belegte B/C/D übernehmen.
  if (candidate.id!==checklist.setup?.primary?.id) state.checks={...candidate.checks,
    targets:{status:candidate.targetSelection?.status ?? 'unknown',details:candidate.targetSelection?.details ?? []}};
  return restoreTradeSetup2Snapshot(JSON.parse(JSON.stringify({schemaVersion:1,id:candidate.id,instrument:checklist.instrument,
    setupKey:candidate.id,direction:candidate.direction,knownAt:candidate.knownAsOf,entry:null,
    checklist:state,m1Check:null,evidence:tradeSetup2Evidence({checklist:state})})));
}

export function buildTradeSetup2Snapshot(input) {
  const { checklist, m1Check } = input;
  const entry=m1Check?.entry;
  // Ein späterer UI-Stand ist kein damaliger Entry-Stand. Der Scanner muss dafür
  // denselben Evaluator am geschlossenen Entry-Präfix aufrufen.
  if (!entry || checklist?.status!=='ready' || checklist.evaluatedAt!==entry.recognizedAt
    || m1Check.evaluatedAt!==entry.recognizedAt || !checklist.setup?.primary
    || checklist.setup.primary.id!==entry.setupKey) return null;
  const { instrument, evaluatedAt, status, checks, structure, tradeability }=checklist;
  return restoreTradeSetup2Snapshot(JSON.parse(JSON.stringify({schemaVersion:1,id:entry.id,instrument,setupKey:entry.setupKey,
    direction:entry.direction,knownAt:entry.recognizedAt,entry,
    checklist:{instrument,evaluatedAt,status,checks,structure,tradeability,setup:{primary:checklist.setup.primary}},
    m1Check,evidence:tradeSetup2Evidence(input)})));
}
