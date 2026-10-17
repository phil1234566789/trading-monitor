import {describe,it,expect} from 'vitest';
import {runnerIncidentId} from '../supabase/functions/_shared/setup2IncidentIdentity.js';
const failure=ms=>`Watcher database POST rpc/setup2_store_live_evidence instrument=EURUSD: response headers, HTTP 400 (P0001), ${ms}ms`;
describe('shared runner and health incident identity',()=>{
 it('shares one identity across reporter calls and variable transport durations',()=>{
  const runner=runnerIncidentId('EURUSD','2026-10-16T13:55:18.964Z',failure(121));
  const health=runnerIncidentId('EURUSD','2026-10-16T13:55:18.964Z',failure(419));
  expect(runner).toBe(health);expect(new Set([runner,health]).size).toBe(1);
 });
 it('keeps operation, failure code and instrument distinct',()=>{
  const id=runnerIncidentId('EURUSD',null,failure(121));
  expect(runnerIncidentId('EURUSD',null,failure(121).replace('store_live_evidence','checkpoint'))).not.toBe(id);
  expect(runnerIncidentId('EURUSD',null,failure(121).replace('P0001','PGRST002'))).not.toBe(id);
  expect(runnerIncidentId('GBPUSD',null,failure(121))).not.toBe(id);
 });
 it('opens a new episode after an actual successful evaluation',()=>{
  expect(runnerIncidentId('EURUSD','2026-10-17T07:00:00Z',failure(121)))
   .not.toBe(runnerIncidentId('EURUSD','2026-10-16T13:55:18.964Z',failure(121)));
 });
 it('keeps unresolved startup failures stable and preserves meaningful numeric details',()=>{
  expect(runnerIncidentId('EURUSD',undefined,failure(121))).toBe(runnerIncidentId('EURUSD',null,failure(419)));
  expect(runnerIncidentId('EURUSD',null,'FXCM-M1-Feed 180s hinter')).not.toBe(runnerIncidentId('EURUSD',null,'FXCM-M1-Feed 240s hinter'));
 });
});
