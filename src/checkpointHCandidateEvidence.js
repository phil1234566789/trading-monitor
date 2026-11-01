import {setupEntryConditions} from './tradeSetup2Review.js';
import {entryPatternVersion} from './entryPattern.js';
import {entryPattern1ConditionsReady,isEntryPattern1} from './entryPattern1Conditions.js';
import {formatBerlinTime,formatDatedTime} from './berlinTime.js';
import {snapshotChecklistAt} from './checklistReplayView.js';

const patternKeys=new Set(['m5Bos','m1PivotBreak','m1Choch','m5Choch','m1Bos','retest','fvg']);
const unknown=(proof,candidateAt=null)=>({state:'uncertain',summary:'Grund mit gespeicherten Daten nicht feststellbar.',proof:[proof],candidateAt});

// Einzelbelege können später grün sein, obwohl sie am FVG-Schluss noch kein Pattern ergaben.
export function checkpointHCandidateEvidence(snapshot,at) {
  const known=t=>Number.isFinite(t)&&t<=at;
  const frames=[...(snapshot.checklistHistory?.entries ?? []),snapshot]
    .filter(frame=>known(frame.knownAt)&&known(frame.m1Check?.evaluatedAt));
  const fvgs=[...new Set(frames.map(frame=>frame.m1Check.conditions?.fvg?.recognizedAt ?? frame.m1Check.fvg?.recognizedAt).filter(known))].sort((a,b)=>a-b);
  if(!fvgs.length)return unknown('Es fehlt ein gespeicherter FVG-Kandidat mit seiner damaligen Patternprüfung.');
  const results=fvgs.map(candidateAt=>{
    const frame=frames.find(f=>f.m1Check.evaluatedAt===candidateAt
      && (f.m1Check.conditions?.fvg?.recognizedAt ?? f.m1Check.fvg?.recognizedAt)===candidateAt);
    if(!frame)return unknown(`Die gespeicherte Prüfung zum FVG-Zeitpunkt ${formatDatedTime(candidateAt)} Uhr fehlt. Spätere Einzelbelege ersetzen sie nicht.`,candidateAt);
    const m1=frame.m1Check,version=entryPatternVersion(m1) ?? entryPatternVersion(frame.checklist);
    if(m1.status==='error')return {state:'technical',candidateAt,
      summary:`Technischer Fehler bei der Patternprüfung um ${formatBerlinTime(candidateAt)} Uhr.`,proof:m1.details ?? []};
    if(!isEntryPattern1(version))return unknown('Die gespeicherte Patternversion erlaubt hier keine zeitliche Entry-Erklärung.',candidateAt);
    const current=snapshotChecklistAt(snapshot,candidateAt) ?? frame;
    const review=setupEntryConditions({...current,instrument:snapshot.instrument,direction:snapshot.direction,knownAt:candidateAt,m1Check:m1});
    const gate=frame.knownAt===candidateAt?(frame.entryEligibility ?? frame.checklist?.checks?.time):null;
    if(gate?.status==='blocked')return {state:'blocked',candidateAt,
      summary:`Kein Entry um ${formatBerlinTime(candidateAt)} Uhr: gespeicherte Handelszeit-/Session-/News-Sperre.`,proof:gate.details ?? []};
    const missing=review.rows.find(row=>patternKeys.has(row.key)&&row.status==='unmet'&&Object.hasOwn(m1.conditions ?? {},row.key));
    if(!missing){
      const ready=entryPattern1ConditionsReady(m1.conditions,snapshot.direction,candidateAt,version);
      return unknown(ready?`Das gespeicherte Pattern war um ${formatDatedTime(candidateAt)} Uhr erfüllt; die damalige Entry-Freigabe oder Ablehnung ist nicht gespeichert.`
        :`Eine vollständige gespeicherte Pattern-/Gateprüfung zum FVG-Zeitpunkt ${formatDatedTime(candidateAt)} Uhr fehlt. Aus grünen Einzelbelegen folgt keine Freigabe.`,candidateAt);
    }
    const later=frames.map(f=>f.m1Check.conditions?.[missing.key]).filter(f=>known(f?.recognizedAt)&&f.recognizedAt>candidateAt
      && (!f.direction||f.direction===snapshot.direction))
      .sort((a,b)=>a.recognizedAt-b.recognizedAt)[0];
    const summary=later?`Kein Entry um ${formatBerlinTime(candidateAt)} Uhr: ${missing.label} erst um ${formatBerlinTime(later.recognizedAt)} Uhr bestätigt.`
      :`Kein Entry um ${formatBerlinTime(candidateAt)} Uhr: ${missing.label} bei der FVG-Bestätigung nicht erfüllt.`;
    return {state:'missing',summary,candidateAt,proof:[`Gespeicherte Prüfung ${formatDatedTime(candidateAt)} Uhr: ${missing.label} nicht erfüllt.`]};
  });
  // Ein anderer unbelegter Kandidat verhindert eine sichere Gesamtursache für die DR.
  const result=results.find(r=>['uncertain','technical'].includes(r.state)) ?? results.at(-1);
  const lastCheck=Math.max(...frames.map(f=>f.m1Check.evaluatedAt));
  if(result.state==='missing'&&lastCheck>result.candidateAt)
    result.proof.push(`Bis zur letzten M1-Prüfung ${formatDatedTime(lastCheck)} Uhr ist danach keine spätere FVG-Bestätigung gespeichert.`);
  return result;
}
