import {expect,it} from 'vitest';
import {setup2DailyRun,buildTradeSetup2Configuration,supportsSnapshotIndicators} from '../src/tradeSetup2Configuration.js';
import {OBSERVATION_RULE_VERSION} from '../src/checklistObservationRules.js';
import {setupMemoKey} from '../src/setup2Memo.js';
it('versions observation-only F while retaining the old run reader and separating memo keys',()=>{
  const config=buildTradeSetup2Configuration({instrument:'GBPUSD'});
  expect(config).toMatchObject({setupVersion:'ls-entry-patterns-xau-m5-positive-gap-v29',entryPattern:'countertrend-entry-model-1-v11',includeSweepRetestSources:true,
    entryPattern2OrderBlockRule:{version:'ob-beyond-ls-max-depth-until-entry-v1',maxRetestFraction:.5},
    entryPattern1SweepAgeRule:{version:'p1-sweep-level-business-age-4h-v1',minimumAgeSeconds:{GBPUSD:14400,XAUUSD:14400}},
    entryPatterns:['countertrend-entry-model-1-v11','m1-structure-fvg-retest-v1'],m1Periods:{'countertrend-entry-model-1-v11':5,'m1-structure-fvg-retest-v1':2},drRiskVersion:'joint-sl-loss-streak-v2',
    antiConfluenceRules:[{id:'h1CounterDivergence',disqualifies:false}]});
  expect(supportsSnapshotIndicators('countertrend-entry-model-1-v23')).toBe(true);
  expect(supportsSnapshotIndicators('countertrend-entry-model-1-v24')).toBe(true);
  expect(supportsSnapshotIndicators('ls-entry-patterns-v25')).toBe(true);
  expect(supportsSnapshotIndicators('ls-entry-patterns-causal-alias-v26')).toBe(true);
  expect(supportsSnapshotIndicators('ls-entry-patterns-ob-depth-v27')).toBe(true);
  expect(supportsSnapshotIndicators('xau-v30-both-pattern-local-sweep-age-v3')).toBe(true);
  expect(supportsSnapshotIndicators('xau-v30-both-pattern-local-sweep-age-v4')).toBe(false);
  expect(supportsSnapshotIndicators('xau-v30-both-entry-patterns-causal-alias-v2')).toBe(true);
  expect(supportsSnapshotIndicators('countertrend-entry-model-1-v21')).toBe(true);
  expect(supportsSnapshotIndicators('countertrend-entry-model-1-v9')).toBe(true);
  const source={instrument:'GBPUSD',tradeSetupId:3125};
  expect(setupMemoKey(source,null,[OBSERVATION_RULE_VERSION],[],0))
    .not.toBe(setupMemoKey(source,null,['checklist-observation-rules-v1'],[],0));
});
it('uses actual Berlin calendar days across both daylight saving transitions',async()=>{
  const spring=await setup2DailyRun({instrument:'GBPUSD'},Date.parse('2026-03-29T12:00:00+02:00')/1000);
  const autumn=await setup2DailyRun({instrument:'GBPUSD'},Date.parse('2026-10-25T12:00:00+01:00')/1000);
  expect(spring.to-spring.from).toBe(23*3600);
  expect(autumn.to-autumn.from).toBe(25*3600);
});
it('reads the exact frozen recognition snapshot version without broad future-version fallback',()=>{
  const metadata={instrument:'XAUUSD',setupVersion:'xau-v30-both-frozen-recognition-v1'};
  expect(supportsSnapshotIndicators(metadata.setupVersion)).toBe(true);
  expect(supportsSnapshotIndicators('countertrend-entry-model-1-v30')).toBe(true);
  expect(supportsSnapshotIndicators('xau-v30-both-entry-patterns-causal-alias-v2')).toBe(true);
  for(const version of ['xau-v30-both-frozen-recognition-v2','countertrend-entry-model-1-v31','xau-v30-unknown',undefined,null,''])
    expect(supportsSnapshotIndicators(version)).toBe(false);
  expect(buildTradeSetup2Configuration({instrument:metadata.instrument}).setupVersion)
    .toBe('ls-entry-patterns-xau-m5-positive-gap-v29');
});
