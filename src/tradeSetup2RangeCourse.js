import { groupSetupSnapshots } from './tradeSetup2Review.js';
import { evaluateChecklistLifecycle } from './tradeSetupChecklistLifecycle.js';
import { markIgnoredCandles } from './sessionOccurrences.js';
import { berlinOffsetMinutes } from './berlinTime.js';

export const RANGE_COURSE_VERSION = 'first-validation-frozen-levels-m5-v1';

// Der Verlauf ergänzt die erste validierte Idee, ohne ihren historischen Checklist-Stand
// oder eine spätere Richtungsänderung als neue Validierung auszugeben.
export function completeSavedRangeCourses(snapshots, candles, evaluatedAt, sessionConfigs = []) {
  const updates = new Map();
  for (const group of groupSetupSnapshots(snapshots)) {
    if (group.entries.length || !group.firstValidated || !group.latestCandidate) continue;
    const first = group.firstValidated, primary = first.checklist?.setup?.primary;
    const selection = primary?.targetSelection;
    if (selection?.status !== 'passed' || !Number.isFinite(selection.selectedAt)
      || selection.selectedAt > first.knownAt || selection.target1?.knownAt > first.knownAt
      || evaluatedAt <= first.knownAt) continue;
    const rows = markIgnoredCandles(candles.filter(c => c.time >= first.knownAt && c.time + 300 <= evaluatedAt),
      sessionConfigs.filter(s => s.instrument === first.instrument), sec => berlinOffsetMinutes(sec * 1000));
    const rangeCourse = { version: RANGE_COURSE_VERSION, setupKey: first.setupKey, validatedAt: first.knownAt,
      direction: primary.direction, selectedAt: selection.selectedAt, target1: selection.target1.price,
      invalidation: primary.invalidation, source: 'FXCM Bid M5',
      lifecycle: evaluateChecklistLifecycle({ selection, invalidation: primary.invalidation,
        candles: rows, fromTime: first.knownAt, evaluatedAt }) };
    updates.set(group.latestCandidate.id, { ...group.latestCandidate, rangeCourse });
  }
  return snapshots.map(snapshot => updates.get(snapshot.id) ?? snapshot);
}
