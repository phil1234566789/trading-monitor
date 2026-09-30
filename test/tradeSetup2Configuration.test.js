import {expect,it} from 'vitest';
import {setup2DailyRun} from '../src/tradeSetup2Configuration.js';
it('uses actual Berlin calendar days across both daylight saving transitions',async()=>{
  const spring=await setup2DailyRun({instrument:'GBPUSD'},Date.parse('2026-03-29T12:00:00+02:00')/1000);
  const autumn=await setup2DailyRun({instrument:'GBPUSD'},Date.parse('2026-10-25T12:00:00+01:00')/1000);
  expect(spring.to-spring.from).toBe(23*3600);
  expect(autumn.to-autumn.from).toBe(25*3600);
});
