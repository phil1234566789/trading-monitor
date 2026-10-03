// Derselbe fachliche Scanner wie im Jahreslauf; der Worker hält Pan/Zoom und
// Abbrechen bedienbar, während die historischen Präfixe ausgewertet werden.
export function scanTradeSetup2InWorker(input,{signal,onProgress,loadM1Candles}={}) {
  return new Promise((resolve,reject)=>{
    signal?.throwIfAborted();
    const worker=new Worker(new URL('./tradeSetup2ScanWorker.js',import.meta.url),{type:'module'});
    const cleanup=()=>{worker.terminate();signal?.removeEventListener('abort',cancel);};
    const cancel=()=>{cleanup();reject(new DOMException('Aborted','AbortError'));};
    signal?.addEventListener('abort',cancel,{once:true});
    worker.onmessage=async ({data})=>{
      if(data.m1Request){
        try { const candles=await loadM1Candles(data.m1Request); if(!signal?.aborted)worker.postMessage({m1Response: candles}); }
        catch(e){cleanup();reject(e);}
        return;
      }
      if(data.progress){onProgress?.(data.progress);return;}
      cleanup();data.error?reject(new Error(data.error)):resolve(data.snapshots);
    };
    worker.onerror=event=>{cleanup();reject(new Error(event.message));};
    worker.postMessage(JSON.parse(JSON.stringify(input)));
  });
}
