import { savedDealingRangeStatus } from './tradeSetup2DealingRange.js';
import { RANGE_COURSE_VERSION } from './tradeSetup2RangeCourse.js';

export function savedRangeOutcome(group) {
  if (group.entries.length || savedDealingRangeStatus(group.snapshot) !== 'validated') return null;
  const first = group.firstValidated;
  const initial = first?.checklist?.setup?.primary;
  const latest = group.snapshot.checklist?.setup?.primary;
  const course = group.snapshot.rangeCourse;
  const complete = course?.version === RANGE_COURSE_VERSION && course.setupKey === first?.setupKey
    && course.validatedAt === first?.knownAt && course.direction === initial?.direction
    && course.selectedAt === initial?.targetSelection?.selectedAt
    && course.target1 === initial?.targetSelection?.target1?.price && course.invalidation === initial?.invalidation;
  const lifecycle = complete ? course.lifecycle : latest?.lifecycle;
  const main = lifecycle?.main;
  const result = { status: 'unknown', label: 'Daten / spätere Auswertung fehlen',
    from: first?.knownAt, through: lifecycle?.evaluatedAt, target1: initial?.targetSelection?.target1?.price,
    invalidation: initial?.invalidation, recognizedAt: null, reason: 'Kein späterer Verlaufsstand gespeichert.' };
  if (!Number.isFinite(result.from) || !Number.isFinite(result.target1) || !Number.isFinite(result.invalidation)) return result;
  if (initial.targetSelection?.status !== 'passed' || !Number.isFinite(initial.targetSelection.selectedAt)
    || initial.targetSelection.selectedAt > result.from || initial.targetSelection.target1.knownAt > result.from) return result;
  // Nur den damaligen T1 und die Invalidierung der Idee vergleichen; kein Execution-SL.
  if (!complete && (latest?.targetSelection?.target1?.price !== result.target1 || latest?.invalidation !== result.invalidation
    || latest?.direction !== initial.direction || latest?.targetSelection?.selectedAt !== initial.targetSelection.selectedAt)) {
    return { ...result, reason: 'Späterer Stand verwendet andere DR-Grenzen.' };
  }
  if (!Number.isFinite(result.through) || !complete && result.through > group.snapshot.knownAt || result.through <= result.from) return result;
  if (main?.state === 'ended') {
    if (!Number.isFinite(main.endedAt) || !Number.isFinite(main.recognizedAt) || main.recognizedAt > result.through) return result;
    // Vor der ersten gespeicherten Validierung erreichte Levels sind kein weiterer DR-Verlauf.
    if (main.endedAt < result.from) return { ...result, reason: 'Gespeichertes Ereignis liegt vor der Validierung; weiterer Verlauf nicht ausgewertet.' };
    const label = { target1: 'Target T1 zuerst erreicht', invalidation: 'Invalidierung zuerst erreicht', both: 'Uneindeutig · T1 und Invalidierung in derselben M5-Kerze' }[main.reason];
    return label ? { ...result, status: main.reason === 'both' ? 'ambiguous' : main.reason, label,
      recognizedAt: main.recognizedAt, reason: null } : result;
  }
  if (main?.state === 'active') return { ...result, status: 'open', label: 'Noch offen am gespeicherten Stand', reason: null };
  return { ...result, reason: main?.reason === 'missingHistory' ? 'Kerzenhistorie unvollständig; Reihenfolge nicht belegbar.' : result.reason };
}
