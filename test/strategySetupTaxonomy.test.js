import {expect,it} from 'vitest';
import {STRATEGY_SETUP_KEYS,normalizeStrategySetup,strategySetupLabel} from '../src/strategySetupLabels.js';
import {comparisonFilters,simulationSetupType,filterReviewGroups} from '../src/simulationRunComparison.js';

it('merges only the two assigned LS categories under the canonical setup1 key',()=>{
 expect(STRATEGY_SETUP_KEYS).toEqual(['setup1','setup3','setup4','continuation','unknown']);
 for(const key of ['countertrend','setup2','setup1']){
  expect(normalizeStrategySetup(key)).toBe('setup1');
  expect(strategySetupLabel(key)).toBe('Setup 1 mit LS');
 }
});
it('preserves open continuation, unproven setups and the remaining numbers',()=>{
 for(const key of ['setup3','setup4','continuation','unknown','unclear',null])expect(normalizeStrategySetup(key)).toBe(key);
 expect(normalizeStrategySetup('trendContinuation')).toBe('continuation');
 expect(strategySetupLabel('trendContinuation')).toBe('Trendfortführung · Setup offen');
});
it.each(['countertrend','setup2','setup1'])('keeps the old %s statistics link and finds both assigned LS classes',key=>{
 const filters=comparisonFilters({type:key,run:'old'});
 expect(filters).toMatchObject({type:'setup1',run:'old'});
 const groups=['countertrend','setup2','setup1','continuation','unknown'].map(setupType=>({setupType,entries:[]}));
 expect(filterReviewGroups(groups,filters).map(g=>g.setupType)).toEqual(['countertrend','setup2','setup1']);
 expect(filterReviewGroups(groups,{type:key})).toHaveLength(3);
});
it('normalizes presentation without rewriting a historical algorithm payload',()=>{
 const snapshot={checklist:{model:'countertrend',setup:{primary:{setupType:'setup2'}}}};
 const original=structuredClone(snapshot);
 expect(simulationSetupType(snapshot)).toBe('setup1');
 expect(snapshot).toEqual(original);
 expect(simulationSetupType({checklist:{setupType:'trendContinuation'}})).toBe('continuation');
});
