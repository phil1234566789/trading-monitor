import {describe,it,expect,vi} from 'vitest';
import {confirmMmtBatch} from '../src/mmtBatchSearch.js';
const rows=()=>['one','two'].map(accountId=>({accountId,state:'prepared',confirmation:'signed-'+accountId,preview:{intent:{id:'order-'+accountId}}}));
describe('account-bound batch confirmation',()=>{
 it('persists uncertainty before each dispatch and keeps successful accounts on retry',async()=>{
  const batch=rows(),persist=vi.fn(),api=vi.fn()
   .mockResolvedValueOnce({order:{status:'searching'}}).mockRejectedValueOnce(new Error('timeout'));
  await confirmMmtBatch(api,batch,persist);
  expect(batch.map(r=>r.state)).toEqual(['searching','unknown']);
  expect(api.mock.calls.map(c=>c[1].account_id)).toEqual(['one','two']);
  await confirmMmtBatch(api,batch,persist);
  expect(api).toHaveBeenCalledTimes(2);
 });
 it('continues with another account after a definitive rejection',async()=>{
  const batch=rows(),api=vi.fn().mockRejectedValueOnce(Object.assign(new Error('expired'),{definitiveRejection:true}))
   .mockResolvedValueOnce({order:{status:'searching'}});
  await confirmMmtBatch(api,batch,()=>{});
  expect(batch.map(r=>r.state)).toEqual(['rejected','searching']);
 });
 it('never sends if persistent reservation fails',async()=>{
  const api=vi.fn();
  await expect(confirmMmtBatch(api,rows(),()=>{throw new Error('storage');})).rejects.toThrow('storage');
  expect(api).not.toHaveBeenCalled();
 });
});
