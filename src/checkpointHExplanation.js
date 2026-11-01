import {checkpointHCandidateEvidence} from './checkpointHCandidateEvidence.js';
import {formatDatedTime} from './berlinTime.js';
export {CHECKPOINT_H_KEYS} from './checkpointHCandidateEvidence.js';

export function checkpointHExplanation(snapshot,at=snapshot.knownAt) {
 const candidates=checkpointHCandidateEvidence(snapshot,at);
 const frames=[...(snapshot.checklistHistory?.entries ?? []),snapshot].filter(f=>Number.isFinite(f.knownAt)&&f.knownAt<=at);
 const technicalNotes=frames.flatMap(f=>[f.checklist,f.m1Check].filter(c=>c?.status==='error'&&Number.isFinite(c.evaluatedAt)&&c.evaluatedAt<=at)
  .map(c=>`Technischer Fehler ${formatDatedTime(c.evaluatedAt)} Uhr: ${(c.details ?? []).join(' ')}`));
 return {candidates,technicalNotes:[...new Set(technicalNotes)],empty:'Keine zeitgleiche Kandidatenprüfung gespeichert. Entry / kein Entry ist nicht beurteilbar.'};
}
