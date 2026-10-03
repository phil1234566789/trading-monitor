import { describe, it, expect } from 'vitest';
import { summarizeAntiConfluenceRules, checklistObservationRules, H1_COUNTER_DIVERGENCE_RULE } from '../src/checklistObservationRules.js';
import { evaluateChecklistConfluences } from '../src/tradeSetupChecklistConfluences.js';
import { evaluateDealingRange } from '../src/tradeSetup2DealingRange.js';
import { buildTradeSetup2CandidateSnapshot, restoreTradeSetup2Snapshot } from '../src/tradeSetup2Snapshot.js';
import { tradeSetup2Evidence } from '../src/tradeSetup2Evidence.js';
import { setupEntryConditions } from '../src/tradeSetup2Review.js';

const rule = (id, status, invalidates = true, evidence = []) => ({ id, label: id, status, invalidates, evidence });
function checklist(rules) {
  const checks = Object.fromEntries(['liquiditySweep','reaction','outerM5Trend','m5Trend'].map(key => [key, { status: 'passed' }]));
  checks.antiConfluences = { rules, status: summarizeAntiConfluenceRules(rules) };
  const primary = { id: 'test', setupType: 'countertrend', direction: 'short', knownAsOf: 600,
    reactionRecognizedAt: 300, checks, targetSelection: { status: 'passed', selectedAt: 300, target1: { price: 1 } } };
  return { instrument: 'GBPUSD', model: 'countertrend', status: 'ready', evaluatedAt: 600, checks, setup: { primary } };
}
describe('anti-confluence rule list', () => {
  it.each([
    [[rule('a','found'), rule('b','unknown')], 'found'],
    [[rule('a','found',false), rule('b','clear')], 'clear'],
    [[rule('a','found',false), rule('b','unknown')], 'unknown'],
    [[rule('a','unknown',false)], 'clear'],
  ])('aggregates enabled rules only (%j)', (rules, status) => expect(summarizeAntiConfluenceRules(rules)).toBe(status));
  it('keeps missing H1 data observable without blocking when invalidation is disabled', () => {
    const result = evaluateChecklistConfluences({ evaluatedAt: 600, direction: 'short' });
    expect(result.antiConfluences).toMatchObject({ status: 'clear', rules: [
      { id: 'h1CounterDivergence', invalidates: false, status: 'unknown', evidence: [] },
    ] });
    expect(result.antiConfluences.rules).toHaveLength(1);
  });
  it.each([['pending','found'], ['passed','clear'], ['unknown','unknown']])('reads legacy F=%s as %s', (status, expected) => {
    expect(checklistObservationRules({ status }, 'antiConfluences')[0].status).toBe(expected);
  });
  it('keeps observation-only hits in snapshots without invalidating the DR', () => {
    const evidence = [{kind:'segment',type:'bullish',timeframe:'1H',fromTime:100,toTime:200,
      fromPrice:1.2,toPrice:1.1,recognizedAt:300}];
    const rules = [{...H1_COUNTER_DIVERGENCE_RULE,status:'found',evidence}];
    const state = checklist(rules);
    expect(evaluateDealingRange(state).status).toBe('validated');
    const snapshot = buildTradeSetup2CandidateSnapshot({ checklist: state, candidate: state.setup.primary });
    expect(snapshot.checklist.checks.antiConfluences.rules).toEqual(rules);
    expect(restoreTradeSetup2Snapshot(snapshot).dealingRange.status).toBe('validated');
    expect(tradeSetup2Evidence({checklist:state}).some(e=>e.checkKey==='antiConfluences')).toBe(true);
    const enabled = checklist([{...rules[0],invalidates:true}]);
    expect(evaluateDealingRange(enabled).status).toBe('invalidated');
  });
  it('does not invalidate from future evidence', () => {
    expect(evaluateDealingRange(checklist([rule('future','found',true,[{recognizedAt:601}])])).status).toBe('confirmed');
  });
  it.each([['clear','passed'],['found','unmet'],['unknown','unknown']])('review reads F=%s as %s', (status, expected) => {
    const state = checklist([rule('h1CounterDivergence',status)]);
    const result = setupEntryConditions({knownAt:600,instrument:'GBPUSD',checklist:state});
    expect(result.rows.find(r => r.key==='antiConfluences')).toMatchObject({status:expected,label:'F · Anti-Confluences prüfen'});
  });
  it('a known hit takes precedence over an unknown rule with future evidence', () => {
    expect(evaluateDealingRange(checklist([rule('known','found'),rule('future','found',true,[{recognizedAt:601}])])).status).toBe('invalidated');
  });
  it('restores legacy rule statuses without recomputing saved DR stages or mutating source data', () => {
    const snapshot = { dealingRange: {version:'countertrend-abcdef-v1',status:'confirmed'},
      checklist: { checks: {antiConfluences:{status:'pending'}}, setup:{primary:{checks:{antiConfluences:{status:'passed'}}}} } };
    const restored = restoreTradeSetup2Snapshot(snapshot);
    expect(restored.checklist.checks.antiConfluences).toMatchObject({status:'found',rules:[{status:'found',invalidates:true}]});
    expect(restored.checklist.setup.primary.checks.antiConfluences.status).toBe('clear');
    expect(restored.dealingRange).toEqual(snapshot.dealingRange);
    expect(snapshot.checklist.checks.antiConfluences).toEqual({status:'pending'});
  });
  it('retains all legacy evidence for validation while showing only the latest H1 line', () => {
    const state = checklist([]);
    state.checks.antiConfluences = {status:'pending',divergences:{candidates:[{recognizedAt:300},{recognizedAt:601}]}};
    expect(checklistObservationRules(state.checks.antiConfluences,'antiConfluences')[0].evidence).toHaveLength(2);
    expect(evaluateDealingRange(state).status).toBe('invalidated');
    expect(tradeSetup2Evidence({checklist:state}).filter(e => e.checkKey==='antiConfluences')).toHaveLength(0);
  });
  it('draws evidence of every rule, including observations, causally', () => {
    const drawing = {kind:'line',timeframe:'5m',recognizedAt:300,price:1.2,fromTime:100,toTime:200};
    const state = checklist([rule('a','found',true,[drawing]), rule('b','found',false,[{...drawing,price:1.3}]),
      rule('future','found',true,[{...drawing,recognizedAt:601,price:1.4}])]);
    expect(tradeSetup2Evidence({checklist:state}).filter(e => e.checkKey==='antiConfluences'))
      .toMatchObject([{ruleId:'a',label:'a',kind:'line'},{ruleId:'b',label:'b',kind:'line'}]);
  });
});
