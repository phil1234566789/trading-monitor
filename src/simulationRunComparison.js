import { groupSetupSnapshots } from './tradeSetup2Review.js';
import { savedDealingRangeStatus, isDisqualifiedDealingRange } from './tradeSetup2DealingRange.js';
import { savedDealingRangePriceOutcome, DR_OUTCOME_LABELS } from './savedDealingRangePriceOutcome.js';
export { DR_OUTCOME_LABELS } from './savedDealingRangePriceOutcome.js';
import { simulationDateFilter, simulationEntryResult, simulationStatistics } from './tradeSetupSimulationStatistics.js';
import { simulationReviewFeatures } from './simulationReviewFeatures.js';
import { simulationChartReplayTime } from './simulationChartReplayTime.js';
import {sortSimulationRunsByExecution} from './simulationRunPresentation.js';

export const SETUP_TYPE_LABELS = { countertrend: 'Countertrend', continuation: 'Trendfortführung', unknown: 'Typ nicht belegt' };
export const FILTER_DEFAULTS = { run: '', compare: '', instrument: '', type: '', from: '', to: '', stage: '', outcome: '', entry: '', pinned: '', feature: '', value: '' };
export function comparisonFilters(query) {
  return Object.fromEntries(Object.entries(FILTER_DEFAULTS).map(([key, fallback]) => [key, typeof query[key] === 'string' && query[key] !== 'all' ? query[key] : fallback]));
}
export function latestCompletedRun(runs) {
  return sortSimulationRunsByExecution(runs.filter(r => r.status === 'complete'))[0]?.id ?? '';
}
export function simulationSetupType(snapshot) {
  return snapshot.checklist?.setup?.primary?.setupType ?? snapshot.checklist?.setupType ?? snapshot.dealingRange?.model
    ?? snapshot.checklist?.model ?? 'unknown';
}

export function independentRangeOutcome(group) {
  const outcome = savedDealingRangePriceOutcome(group);
  return { ...outcome, replayTime: simulationChartReplayTime({drReplayTime:outcome.endAt ?? outcome.through,knownAt:group.knownAt}) };
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
    && (!filters.type || g.setupType === filters.type) && (!filters.stage || (filters.stage === 'disqualified' ? isDisqualifiedDealingRange(g.latestCandidate ?? g.snapshot) : g.stage === filters.stage))
    && (!filters.outcome || g.outcome.status === filters.outcome)
    && (!filters.entry || (filters.entry === 'with') === !!g.entries.length)
    && (!filters.pinned || (filters.pinned === 'with') === simulationGroupHasPin(g,pins))
    && (!filters.feature || g.features.some(f => f.key === filters.feature && (!filters.value || f.value === filters.value)))
    && (bounds.from == null && bounds.to == null || g.entries.some(entryInPeriod)))
    .map(g => bounds.from == null && bounds.to == null ? g : { ...g, entries: g.entries.filter(entryInPeriod) });
}
export function groupResults(groups, results, filters = {}) {
  const bounds = simulationDateFilter(filters.from, filters.to);
  const keys = new Set(groups.flatMap(g => g.entries.map(e => `${e.runId}:${e.id}`)));
  const replayTimes=new Map(groups.flatMap(g=>g.entries.map(e=>[`${e.runId}:${e.id}`,g.outcome?.replayTime])));
  return results.filter(r => keys.has(`${r.runId}:${r.snapshotId}`)
    && (bounds.from == null || r.entryTime >= bounds.from) && (bounds.to == null || r.entryTime < bounds.to))
    .map(r=>({...r,drReplayTime:replayTimes.get(`${r.runId}:${r.snapshotId}`)}));
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
    confirmed: groups.filter(g => ['confirmed','validated','disqualified','invalidated'].includes(g.stage)).length,
    disqualified: groups.filter(g => isDisqualifiedDealingRange(g.latestCandidate ?? g.snapshot)).length,
    validated: validated.length,
    invalidationBeforeT1: validated.filter(g => g.outcome.status === 'invalidation').length,
    target1: validated.filter(g => g.outcome.stage1 === 'target1' || ['t2','t1Only','t1Open','noTarget2'].includes(g.outcome.status)).length,
    target2: validated.filter(g => g.outcome.status === 't2').length,
    target2Eligible: validated.filter(g => Number.isFinite(g.outcome.target2)).length,
    target2Unknown: validated.filter(g => g.outcome.status === 'unknown').length,
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
