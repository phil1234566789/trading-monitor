import {afterEach,expect,it,vi} from 'vitest';
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});

it('keeps v13 candles but refetches their unverified scalar coverage',async()=>{
  vi.resetModules();
  let stored={key:'GBPUSD:5m',candles:[{time:0},{time:300}],completeUpTo:900};
  const remove=vi.fn(),create=vi.fn();
  vi.stubGlobal('indexedDB',{open(){const req={};queueMicrotask(()=>{
    req.result={deleteObjectStore:remove,createObjectStore:create,objectStoreNames:{contains:()=>true},close:vi.fn(),
      transaction(){const tx={objectStore:()=>({get(){const read={};queueMicrotask(()=>{read.result=stored;read.onsuccess();});return read;},
        put(value){stored=value;queueMicrotask(()=>tx.oncomplete());}})};return tx;}};
    req.onupgradeneeded({oldVersion:13});req.onsuccess();});return req;}});
  const {fetchCandlesCached}=await import('../src/candleCache.js');
  const fetch=vi.fn(async()=>[{time:600},{time:900}]);
  expect(await fetchCandlesCached(fetch,'GBPUSD','5m',2,900000)).toEqual([{time:600},{time:900}]);
  expect(fetch).toHaveBeenCalledOnce();
  expect(remove).not.toHaveBeenCalled();expect(create).not.toHaveBeenCalled();
  expect(stored.candles.map(c=>c.time)).toEqual([0,300,600,900]);
  expect(stored.coverage).toEqual([{from:600,to:900}]);
});

it('continues without cache when an older tab blocks the upgrade, and closes a late connection',async()=>{
  vi.resetModules();vi.spyOn(console,'error').mockImplementation(()=>{});
  let request;const close=vi.fn();
  vi.stubGlobal('indexedDB',{open(){request={};queueMicrotask(()=>request.onblocked?.());return request;}});
  const {fetchCandlesCached}=await import('../src/candleCache.js');
  const fetch=vi.fn(async()=>[{time:900}]);
  const result=await Promise.race([fetchCandlesCached(fetch,'GBPUSD','5m',1,900000),
    new Promise(resolve=>setTimeout(()=>resolve('blocked'),100))]);
  expect(result).toEqual([{time:900}]);
  request.result={close};request.onsuccess();expect(close).toHaveBeenCalledOnce();
});
