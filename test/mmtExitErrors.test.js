import {describe,it,expect,vi} from 'vitest';
import {TARGET_PLAN_REJECTIONS,isTargetPlanRejection} from '../supabase/functions/trading-monitor-mcp/targetPlanErrors.js';
import {createMilkyMetaTraderClient} from '../src/milkyMetaTraderClient.js';
import {targetSaveRejected} from '../src/mmtTargetSave.js';

describe('one shared set of definitive exit plan rejections',()=>{
 it.each(TARGET_PLAN_REJECTIONS)('recognizes the explicit pre-enqueue rejection %s in both UI paths',async code=>{
  const api=createMilkyMetaTraderClient('https://example.test','test-only',vi.fn(async()=>({ok:false,status:400,json:async()=>({code})})));
  const error=await api('target_save').catch(error=>error);
  expect(error.code).toBe(code);expect(error.definitiveRejection).toBe(true);expect(targetSaveRejected(error)).toBe(true);
 });
 it.each(['request_failed','storage_error','invalid_stop_database_error','invalid_target_future_unknown',null])('does not call a storage/unknown failure %s safely rejected',code=>{
  expect(isTargetPlanRejection(code)).toBe(false);expect(targetSaveRejected({code})).toBe(false);
 });
 it('leaves transport timeouts uncertain',()=>expect(targetSaveRejected(new Error('timeout'))).toBe(false));
});
