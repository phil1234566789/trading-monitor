import {scanTradeSetup2Window} from './tradeSetup2Scan.js';
let receiveM1;
self.onmessage=async ({data})=>{
  if(data.m1Response){receiveM1?.(data.m1Response);receiveM1=null;return;}
  try {
    const loadM1Candles=data.lazyM1?request=>new Promise(resolve=>{
      receiveM1=resolve;self.postMessage({m1Request:request});
    }):undefined;
    const snapshots=await scanTradeSetup2Window({...data,loadM1Candles,onProgress:progress=>self.postMessage({progress})});
    self.postMessage({snapshots});
  }catch(error){self.postMessage({error:error.message});}
};
