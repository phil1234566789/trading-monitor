import { evaluateTradingHours, evaluateChecklistTime } from './tradeSetupChecklistTime.js';

/** Alle Entry Patterns passieren dieselbe DB-Handelszeitenprüfung unmittelbar vor der Anlage. */
export function createSetup2Entry(input, create, hoursCheck = evaluateTradingHours) {
  const hours=hoursCheck(input);
  if (hours.status !== 'passed') return null;
  const eligibility=evaluateChecklistTime({...input,hours,sessions:input.sessionConfigs ?? []});
  if (eligibility.status==='blocked') return null;
  const entry=create();
  return entry && typeof entry==='object' ? {...entry,entryEligibility:{...eligibility,hours,evaluatedAt:input.evaluatedAt}} : entry;
}

// Mehrere Patternfacts dürfen im Browser keinen ungeprüften Neben-Entry stehen lassen.
export function gateM1ChecklistEntries(check,input) {
  const candidates=check.entries ?? (check.entry?[check.entry]:[]),allowed=new Map();
  for(const entry of candidates){
    const gated=createSetup2Entry({...input,evaluatedAt:entry.recognizedAt},()=>entry);
    if(gated)allowed.set(entry.id,gated);
  }
  const entry=allowed.get(check.entry?.id) ?? null;
  return {...check,entry,...(check.entries?{entries:[...allowed.values()],
    entryChecks:check.entryChecks.map(item=>({...item,entry:allowed.get(item.entry?.id) ?? null})).filter(item=>item.entry),
    patterns:check.patterns.map(item=>({...item,entry:allowed.get(item.entry?.id) ?? null}))}:{}),
    ...(!entry&&check.entry?{entryBlockedReason:'Handelszeiten, Session oder News sperren diesen Entry.'}:{})};
}
