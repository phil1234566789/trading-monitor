import {it,expect,vi} from 'vitest';
import {loadMmtHistory,refreshMmtHistory} from '../src/milkyMetaTraderHistory.js';
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
it('requests a broker refresh once and reads the list only after completion',async()=>{
 const requests=[{account_id:'a',requested_at:'now'}];
 const api=vi.fn().mockResolvedValueOnce({requests}).mockResolvedValueOnce({done:true,failed:[]}).mockResolvedValueOnce({rows:[],sync:[]});
 const result=await refreshMmtHistory(api);
 expect(api.mock.calls.map(c=>c[0])).toEqual(['history_refresh','history_refresh_status','history_page']);
 expect(api.mock.calls[1][1]).toEqual({requests});
 expect(result.refreshError).toBe('');
});
it('keeps saved history available with a visible refresh warning when the broker refresh fails',async()=>{
 const api=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({rows:[{id:1}],sync:[]}).mockResolvedValueOnce({rows:[]});
 const result=await refreshMmtHistory(api);
 expect(result.rows).toEqual([{id:1}]);
 expect(result.refreshError).toContain('gespeicherte');
});
