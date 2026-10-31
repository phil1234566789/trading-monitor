import {afterEach,expect,it,vi} from 'vitest';
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
it.each([13,14,15])('removes only EURUSD candles after FXCM restore from cache v%s',async(oldVersion)=>{
 vi.resetModules();
 const rows=new Map(['EURUSD:1m','EURUSD:4h','GBPUSD:5m','XAUUSD:1h'].map(key=>[key,{key,candles:[{time:123}]}]));
 const removeStore=vi.fn(),createStore=vi.fn();let openedVersion;
 vi.stubGlobal('IDBKeyRange',{bound:(lower,upper)=>({lower,upper})});
 const store={delete(range){for(const key of rows.keys())if(key>=range.lower&&key<=range.upper)rows.delete(key);},get(key){const read={};queueMicrotask(()=>{read.result=rows.get(key);read.onsuccess();});return read;}};
 vi.stubGlobal('indexedDB',{open(name,version){openedVersion=version;const req={};queueMicrotask(()=>{
  req.result={objectStoreNames:{contains:()=>true},deleteObjectStore:removeStore,createObjectStore:createStore,close:vi.fn(),transaction:()=>({objectStore:()=>store})};
  req.transaction={objectStore:()=>store};req.onupgradeneeded({oldVersion});req.onsuccess();
 });return req;}});
 const {getCachedCandles}=await import('../src/candleCache.js');
 expect((await getCachedCandles('EURUSD','1m')).candles).toEqual([]);
 expect((await getCachedCandles('EURUSD','4h')).candles).toEqual([]);
 expect((await getCachedCandles('GBPUSD','5m')).candles).toEqual([{time:123}]);
 expect((await getCachedCandles('XAUUSD','1h')).candles).toEqual([{time:123}]);
 expect(openedVersion).toBe(16);expect(removeStore).not.toHaveBeenCalled();expect(createStore).not.toHaveBeenCalled();
});
