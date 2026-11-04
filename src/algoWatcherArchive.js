import {createLiveEvidenceRepository} from './liveEvidenceRepository.js';
import {entryPattern1ConditionResults,isEntryPattern1} from './entryPattern1Conditions.js';

const labels = {m5Countertrend:'M5-Countertrend',m5Bos:'M5-BOS',m5Choch:'M5-CHoCH',
 m1PivotBreak:'M1-Pivotbruch',m1Choch:'M1-CHoCH',m1Bos:'M1-BOS',retest:'M5-OB-Retest',fvg:'M1-FVG'};
export const watcherEndLabels = {invalidation:'Invalidation-Level erreicht',target1:'T1 erreicht, daher Entry-Suche beendet',
 target2:'T2 erreicht',both:'Invalidation und Ziel in derselben Kerze',entriesClosed:'Alle Entries geschlossen',
 twoConsecutiveJointLosses:'Risikosperre nach zwei aufeinanderfolgenden Verlusten'};

export function watcherArchivedBlock(snapshot, cutoff) {
 const check = snapshot?.m1Check;
 const conditions = check?.conditions;
 if (!isEntryPattern1(check?.entryPattern) || !conditions || check.status==='error'
     || !Number.isFinite(check.evaluatedAt) || check.evaluatedAt>cutoff || snapshot.entry) return null;
 const rules = entryPattern1ConditionResults(conditions,snapshot.direction,check.evaluatedAt,check.entryPattern);
 const missing = rules.filter(rule => rule.required && !rule.passed && Object.hasOwn(conditions,rule.key)
  && conditions[rule.key]===null && labels[rule.key]).map(rule => labels[rule.key]);
 return missing.length ? {at:check.evaluatedAt,missing} : null;
}

export function watcherArchivedEnd(course, reason, cutoff) {
 const main = course?.lifecycle?.main;
 if (main?.state!=='ended' || main.reason!==reason || !Number.isFinite(main.recognizedAt) || main.recognizedAt>cutoff) return null;
 const target = reason==='target1' || reason==='target2' ? course.lifecycle[reason] : null;
 const level = reason==='invalidation' ? course.invalidation : target ? course[reason] : null;
 return {at:target?.hitAt ?? main.endedAt, recognizedAt:main.recognizedAt, level:Number.isFinite(level)?level:null};
}

export function createWatcherArchive(db) {
 const repo=createLiveEvidenceRepository(db);
 async function latest(range, until, filter) {
  const base=db.from('setup2_live_snapshots').select('id').eq('setup_key',range.setupKey)
   .lte('known_at',new Date(until*1000).toISOString());
  const {data,error}=await filter(base).order('known_at',{ascending:false}).order('captured_at',{ascending:false}).limit(1);
  if(error)throw error;
  return data?.length ? repo.record(data[0].id) : null;
 }
 return async range => {
  if(!Number.isFinite(range.knownAt))return {};
  const ended=range.lifecycle==='ended';
  const original=ended ? await latest(range,range.knownAt,query=>query
   .eq('observation->rangeCourse->lifecycle->main->>state','ended')
   .eq('observation->rangeCourse->lifecycle->main->>reason',range.lifecycleReason)) : null;
  const end=watcherArchivedEnd(original?.observation?.rangeCourse,range.lifecycleReason,range.knownAt);
  const cutoff=ended ? end?.at : range.knownAt;
  const last=!range.entry && Number.isFinite(cutoff) ? await latest(range,cutoff,query=>query
   .not('snapshot->m1Check->>evaluatedAt','is',null)) : null;
  return {end,block:watcherArchivedBlock(last?.snapshot,cutoff)};
 };
}
