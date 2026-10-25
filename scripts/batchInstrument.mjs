import path from 'node:path';
import {openBatchCheckpoint} from './batchCheckpoint.mjs';
import {finalizeBatchResults} from './batchScanResults.mjs';
export async function scanBatchInstrument({core,directory,identity,input,onProgress}){
 const store=await openBatchCheckpoint(path.join(directory,'checkpoints',input.instrument),identity);
 try{
  if(!store.state?.scanComplete){
   let changed=false;
   await core.scanTradeSetup2Window({...input,checkpointIdentity:JSON.stringify(identity),resumeState:store.state?.scan,
    collectSnapshots:false,onSnapshot:s=>{store.append('snapshot',s.setupKey,s);changed=true;},
    onHistory:(key,entry)=>{store.append('history',key,entry);changed=true;},
    onCheckpoint:async(progress,getState)=>{
     if(!changed&&progress.completed%24!==0&&progress.completed!==progress.total)return;
     const scan=getState();await store.commit({scan,scanComplete:progress.completed===progress.total});changed=false;
     await onProgress?.({...progress,entries:scan.entryCount,setups:scan.saved.length,m5Evaluations:scan.evaluations,m1Candles:input.m1Candles.length});
    }});
  }
  if(!store.state)await store.commit({scan:null,scanComplete:true});
  // Fertige Scan-Checkpoints werden nur erneut materialisiert, niemals neu berechnet.
  return await finalizeBatchResults({store,core,directory,instrument:input.instrument,m5Candles:input.m5Candles,m1Candles:input.m1Candles,to:input.toTime+1,sessionConfigs:input.sessionConfigs});
 }finally{await store.close();}
}
