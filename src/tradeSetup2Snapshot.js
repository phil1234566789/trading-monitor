import { tradeSetup2Evidence } from './tradeSetup2Evidence.js';
import { entrySizingAt, entryAgainstM5Allowed } from './tradeSetup2EntrySizing.js';
import { normalizeM1ChecklistPresentation } from './m1ChecklistPresentation.js';
import { evaluateDealingRange } from './tradeSetup2DealingRange.js';
import { evaluateChecklistConfluences } from './tradeSetupChecklistConfluences.js';

export function isTradeSetup2SnapshotView(props) {
  return !!(props.tradeSetup2RunId && props.selectedTradeSetup2Id);
}

// Bereits gespeicherte v1-Stände enthalten noch zeitlose Farbkeys und M1 ohne
// Instrument. Die Darstellung ergänzt das, ohne den historischen Datensatz zu ändern.
export function restoreTradeSetup2Snapshot(snapshot) {
  if (!snapshot) return null;
  return {...snapshot,m1Check:snapshot.m1Check?{
    ...normalizeM1ChecklistPresentation(snapshot.m1Check,snapshot.direction,snapshot.knownAt),instrument:snapshot.instrument}:null,
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
  const dealingRange = evaluateDealingRange(checklist, candidate);
  if (dealingRange.status === 'unconfirmed') return null;
  const state={...checklist,setup:{primary:candidate}};
  delete state.context;
  // Weitere bestätigte Sweeps in derselben H1-Richtung erhalten eigene E/G-Belege.
  if (candidate.id!==checklist.setup?.primary?.id) state.checks={
    ...(checklist.model==='countertrend'?{m5Trend:candidate.checks.m5Trend,outerM5Trend:candidate.checks.outerM5Trend}
      :{h1Trend:checklist.checks.h1Trend}),
    time:checklist.checks.time,...candidate.checks,
    targets:{status:candidate.targetSelection?.status ?? 'unknown',details:candidate.targetSelection?.details ?? []},
    ...evaluateChecklistConfluences({...checklist.context,primary:candidate,
      opposingCandidates:checklist.setup.opposingCandidates,target2:candidate.targetSelection?.target2})};
  state.dealingRange = dealingRange;
  // Tagesfenster können denselben Sweep erneut finden. Die Zeit in der Snapshot-ID
  // schützt seinen früheren Wissensstand; setupKey hält die gemeinsame Range zusammen.
  return restoreTradeSetup2Snapshot(JSON.parse(JSON.stringify({schemaVersion:3,id:`${candidate.id}:stand:${candidate.knownAsOf}`,instrument:checklist.instrument,
    setupKey:candidate.id,direction:candidate.direction,knownAt:candidate.knownAsOf,entry:null,
    dealingRange,checklist:state,m1Check:null,evidence:tradeSetup2Evidence({checklist:state})})));
}

export function buildTradeSetup2Snapshot(input) {
  const { checklist, m1Check } = input;
  const entry=m1Check?.entry;
  // Ein späterer UI-Stand ist kein damaliger Entry-Stand. Der Scanner muss dafür
  // denselben Evaluator am geschlossenen Entry-Präfix aufrufen.
  if (!entry || checklist?.status!=='ready' || checklist.evaluatedAt!==entry.recognizedAt
    || checklist.checks?.time?.status==='blocked'
    || m1Check.evaluatedAt!==entry.recognizedAt || !checklist.setup?.primary
    || checklist.setup.primary.id!==entry.setupKey || checklist.setup.primary.direction!==entry.direction) return null;
  const dealingRange = evaluateDealingRange(checklist);
  if (dealingRange.status !== 'validated') return null;
  if (!entryAgainstM5Allowed(checklist, entry)) return null;
  const { instrument, evaluatedAt, status, checks, structure, tradeability }=checklist;
  const sizedEntry = { ...entry, sizing: entrySizingAt(checklist, entry) };
  return restoreTradeSetup2Snapshot(JSON.parse(JSON.stringify({schemaVersion:3,id:entry.id,instrument,setupKey:entry.setupKey,
    direction:entry.direction,knownAt:entry.recognizedAt,entry:sizedEntry,
    dealingRange,checklist:{instrument,evaluatedAt,status,checks,structure,tradeability,dealingRange,setup:{primary:checklist.setup.primary}},
    m1Check:{...m1Check,entry:sizedEntry},evidence:tradeSetup2Evidence(input)})));
}
