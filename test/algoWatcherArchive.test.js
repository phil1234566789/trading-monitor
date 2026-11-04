import {expect,it} from 'vitest';
import {watcherArchivedBlock,watcherArchivedEnd} from '../src/algoWatcherArchive.js';

it('keeps the price-event candle, recognition and DR check separate',()=>{
 const course={invalidation:1.1224,target1:1.12624,lifecycle:{
  main:{state:'ended',reason:'invalidation',endedAt:100,recognizedAt:160}}};
 expect(watcherArchivedEnd(course,'invalidation',240)).toEqual({at:100,recognizedAt:160,level:1.1224});
 expect(watcherArchivedEnd(course,'invalidation',159)).toBeNull();
 expect(watcherArchivedEnd(course,'target1',240)).toBeNull();
});

it('uses the saved T1 price and hit candle',()=>{
 const course={target1:1.12009,lifecycle:{target1:{hitAt:100},main:{state:'ended',reason:'target1',endedAt:100,recognizedAt:160}}};
 expect(watcherArchivedEnd(course,'target1',240)).toEqual({at:100,recognizedAt:160,level:1.12009});
});

it('only reports a missing mandatory rule at a stored pre-end check',()=>{
 const s={direction:'long',m1Check:{evaluatedAt:100,entryPattern:'countertrend-entry-model-1-v10',conditions:{m5Bos:null,m1PivotBreak:null}}};
 expect(watcherArchivedBlock(s,100)).toEqual({at:100,missing:['M1-Pivotbruch']});
 expect(watcherArchivedBlock(s,99)).toBeNull();
 expect(watcherArchivedBlock({...s,entry:{}},100)).toBeNull();
 expect(watcherArchivedBlock({...s,m1Check:{...s.m1Check,conditions:{m5Bos:null}}},100)).toBeNull();
});
