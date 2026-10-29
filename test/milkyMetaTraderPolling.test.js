import { expect,it } from 'vitest';
import { mmtPollDelay, mmtConnectionStatus } from '../src/milkyMetaTraderPolling.js';
it('polls fast only for open exposure or unfinished execution',()=>{
 expect(mmtPollDelay({bridge:{snapshot:{positions:[]}},orders:[]})).toBe(8000);
 expect(mmtPollDelay({bridge:{snapshot:{positions:[{}]}},orders:[]})).toBe(1000);
 for(const status of ['searching','sending','unknown'])expect(mmtPollDelay({orders:[{status}]})).toBe(1000);
 expect(mmtPollDelay({orders:[{status:'executed'}]})).toBe(8000);
});
it('distinguishes connection health from HTTP activity and idle age',()=>{
 const data={unlocked:true,active:true,status:{online:true},snapshot:{},age:8,error:'',delay:8000};
 expect(mmtConnectionStatus(data).label).toBe('Verbunden');
 expect(mmtConnectionStatus({...data,delay:1000}).label).toBe('Daten veraltet');
 expect(mmtConnectionStatus({...data,snapshot:{worker_error:{}}}).label).toBe('Worker gestört');
 expect(mmtConnectionStatus({...data,error:'Netzwerkfehler'}).label).toBe('Verbindung gestört');
 expect(mmtConnectionStatus({...data,unlocked:false}).label).toBe('MMT gesperrt');
 expect(mmtConnectionStatus({...data,snapshot:null}).state).not.toBe('ok');
});
