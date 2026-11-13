import {it,expect} from 'vitest';
import {evaluateChecklistConfluences} from '../src/tradeSetupChecklistConfluences.js';
import {currentAntiConfluenceCheck,antiConfluenceStatus,restoreChecklistObservationChecks,OBSERVATION_RULE_VERSION} from '../src/checklistObservationRules.js';
import {evaluateCountertrendChecklist} from '../src/countertrendChecklist.js';
import {checklistPresentation} from '../src/tradeSetupChecklistPresentation.js';
it('keeps F empty and clear for both directions regardless of missing or supplied RSI history',()=>{
 for(const direction of ['short','long'])for(const h1Candles of [undefined,[],Array.from({length:40},(_,i)=>({time:i*3600,open:100+i,high:102+i,low:99+i,close:101+i}))]){
  const result=evaluateChecklistConfluences({evaluatedAt:144000,direction,h1Candles});
  expect(result.antiConfluences).toMatchObject({status:'clear',rules:[],ruleVersion:OBSERVATION_RULE_VERSION});
  expect(result.antiConfluences).not.toHaveProperty('divergences');
 }
});
it('retains other explicit F blockers and unknown checks rather than bypassing F wholesale',()=>{
 for(const status of ['found','unknown'])expect(antiConfluenceStatus({ruleVersion:OBSERVATION_RULE_VERSION,rules:[{id:'other',status,disqualifies:true,evidence:[]}]})).toBe(status);
});
it('does not reinsert cached RSI into a new evaluation but reads saved v3/v2 facts unchanged',()=>{
 const historical={ruleVersion:'checklist-observation-rules-v3',status:'found',rules:[{id:'h1CounterDivergence',status:'found',disqualifies:true,evidence:[]}]};
 const before=JSON.stringify(historical);
 expect(evaluateChecklistConfluences({evaluatedAt:600,direction:'short',frozen:{antiConfluences:historical}}).antiConfluences.rules).toEqual([]);
 expect(restoreChecklistObservationChecks({antiConfluences:historical}).antiConfluences.status).toBe('found');
 expect(antiConfluenceStatus({ruleVersion:'checklist-observation-rules-v2',rules:[{id:'legacy',status:'found',invalidates:true}]})).toBe('found');
 expect(JSON.stringify(historical)).toBe(before);
});
it('shows the explicit empty F explanation in current checklist presentation',()=>{
 const state=evaluateCountertrendChecklist({instrument:'GBPUSD',evaluatedAt:600,dataStatus:'missing'});
 expect(state.checks.antiConfluences).toEqual(currentAntiConfluenceCheck());
 expect(checklistPresentation(state).antiConfluences.details).toEqual(['Keine aktiven Anti-Confluence-Regeln.']);
});
