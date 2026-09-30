import {scanTradeSetup2Window} from './tradeSetup2Scan.js';

self.onmessage=async ({data})=>{
  try {
    const snapshots=await scanTradeSetup2Window({...data,onProgress:progress=>self.postMessage({progress})});
    self.postMessage({snapshots});
  }catch(error){self.postMessage({error:error.message});}
};
