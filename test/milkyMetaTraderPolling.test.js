import { expect,it } from 'vitest';
import { mmtPollDelay, mmtConnectionStatus, mmtSelectedAccountId } from '../src/milkyMetaTraderPolling.js';
it('uses an eight-second UI cadence for every active data group',()=>{
 expect(mmtPollDelay({bridge:{snapshot:{positions:[]}},orders:[]})).toBe(8000);
 expect(mmtPollDelay({bridge:{snapshot:{positions:[{}]}},orders:[]})).toBe(8000);
 for(const status of ['searching','sending','unknown'])expect(mmtPollDelay({orders:[{status}]})).toBe(8000);
 expect(mmtPollDelay({orders:[{status:'executed'}]})).toBe(8000);
});
it('adopts external account selection and removal without confusing an older API response with deselection',()=>{
 expect(mmtSelectedAccountId({active_account_id:'b'},'a')).toBe('b');
 expect(mmtSelectedAccountId({active_account_id:null},'a')).toBeNull();
 expect(mmtSelectedAccountId({},'a')).toBe('a');
});
it('distinguishes connection health from HTTP activity and idle age',()=>{
 const data={unlocked:true,active:true,status:{online:true},snapshot:{},age:8,error:'',delay:8000};
 expect(mmtConnectionStatus(data).label).toBe('Verbunden');
 expect(mmtConnectionStatus({...data,age:16}).label).toBe('Daten veraltet');
 expect(mmtConnectionStatus({...data,snapshot:{worker_error:{}}}).label).toBe('Worker gestört');
 expect(mmtConnectionStatus({...data,error:'Netzwerkfehler'}).label).toBe('Verbindung gestört');
 expect(mmtConnectionStatus({...data,unlocked:false}).label).toBe('MMT gesperrt');
 expect(mmtConnectionStatus({...data,snapshot:null}).state).not.toBe('ok');
});

it('retains known worker errors ahead of the cached label',()=>{expect(mmtConnectionStatus({unlocked:true,active:true,status:{ui_cached:true},snapshot:{worker_error:'error'}}).state).toBe('dead');});
