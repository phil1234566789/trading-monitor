import {it,expect,vi} from 'vitest';
import {scanTradeSetup2InWorker} from '../src/tradeSetup2BrowserScan.js';
it('der Worker fordert M1 erst über seine Validierungsnachricht an',async()=>{
 let worker;
 class Worker {constructor(){worker=this;}postMessage=vi.fn();terminate=vi.fn();}
 vi.stubGlobal('Worker',Worker);
 const load=vi.fn(async()=>[{time:600}]);
 try {
  const result=scanTradeSetup2InWorker({lazyM1:true},{loadM1Candles:load});
  expect(load).not.toHaveBeenCalled();
  await worker.onmessage({data:{m1Request:{fromTime:600,toTime:900,instrument:'GBPUSD'}}});
  expect(load).toHaveBeenCalledOnce();expect(worker.postMessage).toHaveBeenLastCalledWith({m1Response:[{time:600}]});
  worker.onmessage({data:{snapshots:[]}});expect(await result).toEqual([]);expect(worker.terminate).toHaveBeenCalledOnce();
 }finally {vi.unstubAllGlobals();}
});
it('ein fehlgeschlagener M1-Abruf beendet den Worker und meldet den Fehler',async()=>{
 let worker;
 class Worker {constructor(){worker=this;}postMessage=vi.fn();terminate=vi.fn();}
 vi.stubGlobal('Worker',Worker);
 try {
  const result=scanTradeSetup2InWorker({lazyM1:true},{loadM1Candles:async()=>{throw new Error('M1 fehlt');}});
  const rejected=expect(result).rejects.toThrow('M1 fehlt');
  await worker.onmessage({data:{m1Request:{}}});await rejected;expect(worker.terminate).toHaveBeenCalledOnce();
 }finally {vi.unstubAllGlobals();}
});
