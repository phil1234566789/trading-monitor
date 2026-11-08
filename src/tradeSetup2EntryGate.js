import { evaluateTradingHours, evaluateChecklistTime } from './tradeSetupChecklistTime.js';

/** Alle Entry Patterns passieren dieselbe DB-Handelszeitenprüfung unmittelbar vor der Anlage. */
export function createSetup2Entry(input, create, hoursCheck = evaluateTradingHours) {
  const {allowed,eligibility}=setup2EntryEligibility(input,hoursCheck);
  if(!allowed)return null;
  const entry=create();
  return entry && typeof entry==='object' ? {...entry,entryEligibility:eligibility} : entry;
}

export function setup2EntryEligibility(input,hoursCheck=evaluateTradingHours) {
  const hours=hoursCheck(input);
  if(hours.status!=='passed')return {allowed:false,eligibility:{...hours,hours,evaluatedAt:input.evaluatedAt}};
  const eligibility=evaluateChecklistTime({...input,hours,sessions:input.sessionConfigs ?? []});
  return {allowed:eligibility.status!=='blocked',eligibility:{...eligibility,hours,evaluatedAt:input.evaluatedAt}};
}

// Mehrere Patternfacts dürfen im Browser keinen ungeprüften Neben-Entry stehen lassen.
export function gateM1ChecklistEntries(check,input) {
  const candidates=check.entries ?? (check.entry?[check.entry]:[]),allowed=new Map(),evaluations=new Map();
  for(const entry of candidates){
    const result=setup2EntryEligibility({...input,evaluatedAt:entry.recognizedAt});
    evaluations.set(entry.id,result);
    for(const match of entry.patternMatches ?? [])evaluations.set(match.id,result);
    if(result.allowed)allowed.set(entry.id,{...entry,entryEligibility:result.eligibility});
  }
  const apply=item=>{
    const result=evaluations.get(item.entry?.id);
    return {...item,entry:allowed.get(item.entry?.id) ?? null,...(result?{entryEligibility:result.eligibility,
      ...(!result.allowed?{patternCandidate:item.entry,entryBlockedReason:result.eligibility.details.join(' ')}:{})}:{})};
  };
  return {...apply(check),...(check.entries?{entries:[...allowed.values()],
    entryChecks:check.entryChecks.map(apply).filter(item=>item.entry),patterns:check.patterns.map(apply)}:{})};
}
