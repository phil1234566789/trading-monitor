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
