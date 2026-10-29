import {it,expect,vi} from 'vitest';
import {loadMmtHistory} from '../src/milkyMetaTraderHistory.js';
it('continues through short pages until empty without skipping row-capped responses',async()=>{
 const api=vi.fn().mockResolvedValueOnce({rows:[{id:1},{id:2}],sync:[{account_id:'a'}]}).mockResolvedValueOnce({rows:[{id:3}]}).mockResolvedValueOnce({rows:[]});
 const result=await loadMmtHistory(api,true);
 expect(result.rows.map(r=>r.id)).toEqual([1,2,3]);
 expect(api.mock.calls.map(c=>c[1].after_id)).toEqual([0,2,3]);
 expect(result.sync).toEqual([{account_id:'a'}]);
 expect(api.mock.calls.every(c=>c[2].background)).toBe(true);
});
it('rejects a non-advancing cursor instead of looping forever',async()=>{
 const api=vi.fn().mockResolvedValue({rows:[{id:1}]});
 await expect(loadMmtHistory(api)).rejects.toThrow('Paginierung');
});
