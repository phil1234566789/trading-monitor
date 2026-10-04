import {expect,it} from 'vitest';
import {setup2DailyRun,buildTradeSetup2Configuration,supportsSnapshotIndicators} from '../src/tradeSetup2Configuration.js';
import {OBSERVATION_RULE_VERSION} from '../src/checklistObservationRules.js';
import {setupMemoKey} from '../src/setup2Memo.js';
it('versions observation-only F while retaining the old run reader and separating memo keys',()=>{
  const config=buildTradeSetup2Configuration({instrument:'GBPUSD'});
  expect(config).toMatchObject({setupVersion:'countertrend-entry-model-1-v12',
    antiConfluenceRules:[{id:'h1CounterDivergence',invalidates:false}]});
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
