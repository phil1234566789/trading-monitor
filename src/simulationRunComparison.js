import { groupSetupSnapshots } from './tradeSetup2Review.js';
import { savedDealingRangeStatus } from './tradeSetup2DealingRange.js';
import { savedRangeOutcome } from './tradeSetup2SavedRangeOutcome.js';
import { simulationDateFilter, simulationEntryResult, simulationStatistics } from './tradeSetupSimulationStatistics.js';
import { simulationReviewFeatures } from './simulationReviewFeatures.js';
import { COUNTERTREND_RANGE_COURSE_VERSION } from './countertrendLifecycle.js';

export const DR_OUTCOME_LABELS = { t2: 'Lief bis T2', t1Only: 'Lief bis T1, nicht T2', invalidation: 'Lief in die Invalidierung',
  open: 'Noch offen', t1Unknown: 'T1 erreicht · T2 nicht belegt', unknown: 'DR-Ausgang nicht belegt' };
export const SETUP_TYPE_LABELS = { countertrend: 'Countertrend', continuation: 'Trendfortführung', unknown: 'Typ nicht belegt' };
export const FILTER_DEFAULTS = { run: '', compare: '', instrument: '', type: '', from: '', to: '', stage: '', entry: '', pinned: '', feature: '', value: '' };
export function comparisonFilters(query) {
  return Object.fromEntries(Object.entries(FILTER_DEFAULTS).map(([key, fallback]) => [key, typeof query[key] === 'string' && query[key] !== 'all' ? query[key] : fallback]));
}
export function latestCompletedRun(runs) {
  return runs.filter(r => r.status === 'complete').toSorted((a,b) => (b.evaluatedAt ?? 0)-(a.evaluatedAt ?? 0) || b.id.localeCompare(a.id))[0]?.id ?? '';
}
export function simulationSetupType(snapshot) {
  return snapshot.checklist?.setup?.primary?.setupType ?? snapshot.checklist?.setupType ?? snapshot.dealingRange?.model
    ?? snapshot.checklist?.model ?? 'unknown';
}

export function independentRangeOutcome(group) {
  if (!group.firstValidated) return { status: 'unknown', label: DR_OUTCOME_LABELS.unknown };
  const courses = [group.latestCandidate, ...group.entries, group.snapshot].map(s => s?.rangeCourse)
    .filter(c => c?.setupKey === group.snapshot.setupKey).sort((a,b) => (b.lifecycle?.evaluatedAt ?? 0)-(a.lifecycle?.evaluatedAt ?? 0));
  let course = courses[0];
  const frozen = group.firstValidated.rangeCourse;
  const latest = group.latestCandidate?.checklist?.setup?.primary;
  // Invalidierte Kandidaten speichern keinen rangeCourse mehr, aber den gleichen Preis-Lifecycle.
  if ((!course || latest?.lifecycle?.evaluatedAt > course.lifecycle?.evaluatedAt) && frozen?.version === COUNTERTREND_RANGE_COURSE_VERSION && latest?.lifecycle
    && latest.direction === frozen.direction && latest.invalidation === frozen.invalidation
    && latest.targetSelection?.selectedAt === frozen.selectedAt && latest.targetSelection?.target1?.price === frozen.target1
    && (latest.targetSelection?.target2?.price ?? null) === frozen.target2) course = { ...frozen, lifecycle: latest.lifecycle };
  if (course?.version === COUNTERTREND_RANGE_COURSE_VERSION) {
    const lifecycle = course.lifecycle, main = lifecycle?.main;
    const known = time => Number.isFinite(time) && time >= course.validatedAt && time <= lifecycle?.evaluatedAt;
    let status = 'unknown';
    // „entriesClosed“ und T1-Ende verkürzen die Messung. Daraus folgt kein „T2 verfehlt“.
    if (main?.reason !== 'both' && known(lifecycle?.target2?.recognizedAt) && lifecycle.target2.status === 'reached') status = 't2';
    else if (main?.reason === 'invalidation' && known(main.recognizedAt)) status = known(lifecycle.target1?.recognizedAt) ? 't1Only' : 'invalidation';
    else if (main?.reason !== 'both' && known(lifecycle?.target1?.recognizedAt)) status = 't1Unknown';
    else if (main?.state === 'active') status = 'open';
    return { status, label: DR_OUTCOME_LABELS[status], through: lifecycle?.evaluatedAt, target1: course.target1,
      target2: course.target2, invalidation: course.invalidation };
  }
  // Der alte Helfer ist auf Entry-lose DRs begrenzt und belegt nie T2.
  const old = savedRangeOutcome({ ...group, entries: [], snapshot: group.latestCandidate ?? group.snapshot });
  const status = { target1: 't1Unknown', invalidation: 'invalidation', open: 'open' }[old?.status] ?? 'unknown';
  return { ...old, status, label: DR_OUTCOME_LABELS[status] };
}

export function reviewGroups(snapshots) {
  return groupSetupSnapshots(snapshots).map(group => ({ ...group,
    stage: savedDealingRangeStatus(group.latestCandidate ?? group.snapshot), wasValidated: !!group.firstValidated,
    recognizedAt: group.candidate?.checklist?.setup?.primary?.recognizedAt ?? group.candidate?.knownAt ?? group.knownAt,
    setupType: simulationSetupType(group.snapshot), outcome: independentRangeOutcome(group),
    features: simulationReviewFeatures(group.snapshot) })).sort((a,b) => b.recognizedAt-a.recognizedAt || a.key.localeCompare(b.key));
}
export function simulationGroupHasPin(group, pins) {
  const ids = new Set([group.snapshot.id, group.candidate?.id, group.latestCandidate?.id, ...group.entries.map(e => e.id)]);
  return pins.some(p => p.simulationRunId === group.snapshot.runId && (ids.has(p.simulationSnapshotId) || ids.has(p.simulationEntrySnapshotId)
    || p.simulationContext?.setupKey === group.snapshot.setupKey));
}
export function filterReviewGroups(groups, filters, pins = []) {
  const bounds = simulationDateFilter(filters.from, filters.to);
  const entryInPeriod = e => {
    const time = e.entry?.recognizedAt ?? e.knownAt;
    return (bounds.from == null || time >= bounds.from) && (bounds.to == null || time < bounds.to);
  };
  return groups.filter(g => (!filters.instrument || g.instrument === filters.instrument)
    && (!filters.type || g.setupType === filters.type) && (!filters.stage || g.stage === filters.stage)
    && (!filters.entry || (filters.entry === 'with') === !!g.entries.length)
    && (!filters.pinned || (filters.pinned === 'with') === simulationGroupHasPin(g,pins))
    && (!filters.feature || g.features.some(f => f.key === filters.feature && (!filters.value || f.value === filters.value)))
    && (bounds.from == null && bounds.to == null || g.entries.some(entryInPeriod)))
    .map(g => bounds.from == null && bounds.to == null ? g : { ...g, entries: g.entries.filter(entryInPeriod) });
}
export function groupResults(groups, results, filters = {}) {
  const bounds = simulationDateFilter(filters.from, filters.to);
  const keys = new Set(groups.flatMap(g => g.entries.map(e => `${e.runId}:${e.id}`)));
  return results.filter(r => keys.has(`${r.runId}:${r.snapshotId}`)
    && (bounds.from == null || r.entryTime >= bounds.from) && (bounds.to == null || r.entryTime < bounds.to));
}
export function variantMetrics(results, variant) {
  const net = simulationStatistics(results,variant,'net'), gross = simulationStatistics(results,variant,'gross');
  const selected = results.filter(r => r.variant === variant);
  return { ...net, grossPnlUsd: gross.pnlUsd, commissionUsd: selected.some(r => r.commissionUsd == null) ? null : selected.reduce((s,r)=>s+r.commissionUsd,0),
    commissionR: gross.totalR == null || net.totalR == null ? null : gross.totalR-net.totalR };
}
export function runFunnel(groups, results) {
  const validated = groups.filter(g => g.wasValidated ?? g.stage === 'validated');
  return { recognized: new Set(groups.map(g => g.snapshot.checklist?.setup?.primary?.tradeSetupId ?? g.snapshot.setupKey ?? g.key)).size,
    confirmed: groups.filter(g => ['confirmed','validated','invalidated'].includes(g.stage)).length,
    disqualified: groups.filter(g => g.stage === 'invalidated' && ['h1CounterDivergence','antiConfluence','targetsUnavailable'].includes((g.latestCandidate ?? g.snapshot)?.dealingRange?.reason)).length,
    validated: validated.length,
    invalidationBeforeT1: validated.filter(g => g.outcome.status === 'invalidation').length,
    target1: validated.filter(g => ['t2','t1Only','t1Unknown'].includes(g.outcome.status)).length,
    target2: validated.filter(g => g.outcome.status === 't2').length,
    withEntry: groups.filter(g => g.entries.length).length, entries: new Set(results.map(r=>r.snapshotId)).size };
}
export function rangeEntryCrossTable(groups, results, variant) {
  const rows = Object.entries(DR_OUTCOME_LABELS).map(([key,label]) => ({ key,label,total:0,without:0,win:0,loss:0,pending:0 }));
  for (const group of groups.filter(g=>g.wasValidated ?? g.stage==='validated')) {
    const row = rows.find(r=>r.key===group.outcome.status) ?? rows.at(-1); row.total++;
    if (!group.entries.length) { row.without++; continue; }
    const entries = group.entries.map(e => simulationEntryResult(results,e,variant));
    if (entries.some(r=>r?.status==='closed' && r.netPnlUsd>0)) row.win++;
    else if (entries.every(r=>r?.status==='closed' && r.netPnlUsd<0)) row.loss++;
    else row.pending++;
  }
  return rows;
}
