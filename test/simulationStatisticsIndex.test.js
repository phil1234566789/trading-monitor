import {it,expect} from 'vitest';
import {encodeStatisticsIndex,decodeStatisticsIndex} from '../src/simulationStatisticsIndex.js';
it('roundtrips unicode, unknown values and ordered results while excluding all details',async()=>{
 const rows=Array.from({length:31},(_,i)=>({key:`dr${i}`,summary:{key:`dr${i}`,label:'Überprüfung · 未知',value:null},results:[{pnl:-1.25}],orders:[i],detail:{doNotLoad:'heavy'}}));
 const encoded=await encodeStatisticsIndex(rows),decoded=await decodeStatisticsIndex(encoded);
 expect(decoded).toEqual(rows.map(({key,summary,results,orders})=>({key,summary,results,orders})));
 expect(JSON.stringify(decoded)).not.toContain('doNotLoad');expect(encoded.length).toBeLessThan(JSON.stringify(rows).length);
 await expect(decodeStatisticsIndex('invalid')).rejects.toThrow();
 await expect(decodeStatisticsIndex(await encodeStatisticsIndex([{key:'a',summary:{key:'different'},results:[],orders:[]}]))).rejects.toThrow('unvollständig');
});
