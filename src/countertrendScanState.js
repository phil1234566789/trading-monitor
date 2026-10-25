export const COUNTERTREND_SCAN_STATE_VERSION='countertrend-scan-state-v1';
export function validateCountertrendResume(input,steps){
 const state=input.resumeState;
 if((state||input.onCheckpoint)&&(!input.checkpointIdentity||typeof input.checkpointIdentity!=='string'))throw new Error('Batch checkpoint requires a frozen input/code identity');
 if((state||input.onCheckpoint)&&input.loadM1Candles)throw new Error('Batch checkpoint requires frozen complete M1 candles');
 if(state&&(input.collectSnapshots!==false||state.version!==COUNTERTREND_SCAN_STATE_VERSION||state.identity!==input.checkpointIdentity||state.instrument!==input.instrument||state.fromTime!==input.fromTime||state.toTime!==input.toTime||!Number.isSafeInteger(state.nextStep)||state.nextStep<0||state.nextStep>steps.length||state.nextAt!==(steps[state.nextStep]??null)))throw new Error('Incompatible batch scan checkpoint');
 return state;
}
export function countertrendScanState({input,steps,nextStep,setupIndex,known,saved,seen,entries,entryCount,evaluations,loadedFrom,lifecycles,executions,searchThrough,entryProgress,checklistHistory,recognized,finalized}){
 const activeKeys=new Set([...known.values()].map(s=>`${input.instrument}:setup1:${s.tradeSetupId}`));
 // Keine Kerzen, fertigen Snapshots oder Strukturpools kopieren; Maps bleiben clone-fähig.
 return{version:COUNTERTREND_SCAN_STATE_VERSION,identity:input.checkpointIdentity,instrument:input.instrument,fromTime:input.fromTime,toTime:input.toTime,nextStep,nextAt:steps[nextStep]??null,setupIndex,knownIds:[...known.keys()],saved:[...saved],seen:[...seen],entryCount,evaluations,loadedFrom,
  entries:entries.filter(s=>activeKeys.has(s.setupKey)).map(s=>({setupKey:s.setupKey,entry:s.entry})),
  lifecycles:lifecycles.entries(),executions:executions.entries(),searchThrough:searchThrough.entries(),
  entryProgress:entryProgress.entries().map(([key,{detectM5OrderBlocks,...value}])=>[key,value]),
  history:checklistHistory.checkpoint(activeKeys),recognizedFinalized:[...recognized].filter(([,base])=>finalized(base)).map(([key])=>key)};
}
