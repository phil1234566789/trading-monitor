import {computed,onScopeDispose,ref,shallowRef,watch} from 'vue';
import {scanTradeSetup2InWorker} from '../tradeSetup2BrowserScan.js';
import {buildTradeSetup2Configuration,setup2DailyRun} from '../tradeSetup2Configuration.js';
import {evaluateSimulation} from '../tradeSetupSimulation.js';
import {tradeSetup2Positions} from '../tradeSetup2Positions.js';
import {restoreTradeSetup2Snapshot} from '../tradeSetup2Snapshot.js';
import {fetchInitialCandles} from '../forexCandles.js';
import {fetchCandlesCached} from '../candleCache.js';
import {REPLAY_LOOKAHEAD_SEC} from '../timeframes.js';
import {renderSetup2Positions,renderSetup2Detail,clearSetup2Primitives} from '../tradeSetup2Rendering.js';

export function useTradeSetup2History(props,checklist,{repository,configurationInput,evaluationTime}) {
  const results=shallowRef([]),selected=shallowRef(null),status=ref(''),error=ref('');
  const loading=ref(false),displayCandles=shallowRef([]);
  let series=null,chart=null,abort=null,revision=0,selectionRevision=0,completedScanKey=null,appliedRouteKey=null;
  let activeInputKey=null,activeAt=null,refreshPending=false;
  const overview=[],details=[],entry=[];
  const snapshots=new Map();
  const positions=computed(()=>tradeSetup2Positions(results.value,{instrument:props.symbol,variant:props.tradeSetup2Variant,
    asOf:evaluationTime(),historyCount:props.tradeSetup2HistoryCount,candles:displayCandles.value}));
  const visibleSnapshot=computed(()=>props.showTradeSetup2 && selected.value?.instrument===props.symbol
    && selected.value.knownAt<=evaluationTime()?selected.value:null);
  function render() {
    if(!series)return;
    renderSetup2Positions(series,props.showTradeSetup2?positions.value:[],overview,displayCandles.value,props.currentBar,visibleSnapshot.value?.id);
    renderSetup2Detail(series,visibleSnapshot.value,details,entry,displayCandles.value,props.currentBar,evaluationTime());
  }
  async function select(id,runId) {
    const ticket=++selectionRevision;
    if(!id){selected.value=null;return;}
    error.value='';
    try {
      const key=`${runId}:${id}`,cached=snapshots.get(key);
      const snapshot=cached ?? await repository.getSnapshot(runId,id)
        ?? await repository.getSetupSnapshot(runId,id);
      if(ticket!==selectionRevision)return;
      if(snapshot?.knownAt>evaluationTime()) error.value='Dieses Setup war am Replay-Stand noch nicht bekannt.';
      const restored=cached ?? restoreTradeSetup2Snapshot(snapshot);
      if(restored)snapshots.set(key,restored);
      selected.value=restored;
      if(!snapshot)error.value='Der gespeicherte Setup-Stand fehlt.';
    } catch(e){if(ticket===selectionRevision)error.value=e.message;}
  }
  function click({point}) {
    if(!point || !props.showTradeSetup2)return;
    const match=overview.filter(p=>p.trade).map(p=>({p,d:p.lineDistanceTo(point.x,point.y)})).filter(x=>x.d<10).sort((a,b)=>a.d-b.d)[0];
    if(match)void select(match.p.trade.snapshotId,match.p.trade.runId);
  }
  async function selectRoute() {
    const id=props.selectedTradeSetup2Id,run=props.tradeSetup2RunId,key=id&&run?`${run}:${id}`:null;
    if(key===appliedRouteKey)return;
    appliedRouteKey=key;
    if(key)await select(id,run);
    else await select(null);
  }
  async function refresh(force=false) {
    if(!props.showTradeSetup2){abort?.abort();revision++;loading.value=false;return;}
    const state=checklist.value,at=Math.floor(evaluationTime()/60)*60;
    if(!Number.isFinite(at))return;
    if(!props.tradeSetup2RunId&&(state?.instrument!==props.symbol||state?.status!=='ready'||state.updating||!state.context))return;
    const input=JSON.parse(JSON.stringify(configurationInput())),inputKey=JSON.stringify([props.tradeSetup2RunId,input]);
    // Ein langer Erstscan muss trotz neuer Live-Minuten fertig werden können.
    // Anschließend den jüngsten Stand nachholen; Replaywechsel brechen weiter ab.
    if(!force&&loading.value&&props.replayUntil==null&&activeInputKey===inputKey&&at>=activeAt){
      refreshPending ||= at>activeAt;
      return;
    }
    abort?.abort();abort=new AbortController();const signal=abort.signal,ticket=++revision;
    activeInputKey=inputKey;activeAt=at;refreshPending=false;
    loading.value=true;error.value='';status.value='Gespeicherte Setups laden…';
    try {
      const configuration=buildTradeSetup2Configuration(input);
      const run=await setup2DailyRun(configuration,at);
      signal.throwIfAborted();
      const runs=await repository.listRuns();signal.throwIfAborted();
      // Ohne expliziten Statistik-Link nur dieselbe Konfiguration zusammenführen.
      const configurationKey=run.id.split(':').at(-1);
      const relevant=runs.filter(r=>props.tradeSetup2RunId ? r.id===props.tradeSetup2RunId
        : r.configuration?.instrument===props.symbol&&r.from<=at
          &&r.id.startsWith('chart:')&&r.id.endsWith(`:${configurationKey}`))
        .sort((a,b)=>b.from-a.from);
      const stored=[];
      for(const r of props.tradeSetup2RunId?relevant.filter(r=>r.id===props.tradeSetup2RunId):relevant) {
        stored.push(...await repository.listResults({runId:r.id,instrument:props.symbol,asOf:at}));
        signal.throwIfAborted();
      }
      results.value=deduplicate(stored);
      const storedStatus=`${new Set(stored.map(r=>r.entryId)).size} gespeicherte Entries`;
      await selectRoute();
      signal.throwIfAborted();
      // Ein verlinkter Forschungslauf bleibt unverändert; der Chart darf ihn nicht neu rechnen.
      if(props.tradeSetup2RunId){status.value=storedStatus;return;}
      const scanKey=`${run.id}:${at}`;
      const savedThrough=runs.find(r=>r.id===run.id)?.progress?.scanCompletedAt;
      if(!force&&(completedScanKey===scanKey||savedThrough>=at)){status.value=storedStatus;return;}
      status.value='M1-Historie laden…';
      const continuing=[...new Map(stored.filter(r=>r.status==='open'&&r.runId!==run.id)
        .map(r=>[`${r.runId}:${r.snapshotId}`,r])).values()];
      const start=Math.min(state.context.m5Candles[0]?.time ?? Infinity,...continuing.map(r=>r.entryTime));
      if(!Number.isFinite(start))return;
      const m1Candles=await fetchCandlesCached(fetchInitialCandles,props.symbol,'1m',Math.ceil((at-start)/60)+11,at*1000,REPLAY_LOOKAHEAD_SEC);
      signal.throwIfAborted();
      const found=await scanTradeSetup2InWorker({...input,h1Candles:state.context.h1Candles,m5Candles:state.context.m5Candles,m1Candles,
        fromTime:run.from,toTime:at},{signal,
        onProgress:p=>{if(ticket===revision)status.value=`Setups auswerten: ${p.completed}/${p.total}`;}});
      signal.throwIfAborted();
      const evaluateSnapshot=snapshot=>({snapshot,outcomes:['wide','narrow'].map(variant=>
        evaluateSimulation({entry:snapshot.entry,variant,candles:m1Candles,evaluatedAt:at,
          target1:snapshot.entry.scales[variant].targets[0]?.price,target2:snapshot.entry.scales[variant].targets[1]?.price ?? null}))});
      const records=found.filter(s=>s.entry).map(evaluateSnapshot);
      // Der Tageswechsel beendet keine Position. Bereits gespeicherte Entries
      // behalten ihren Ursprungslauf und werden unabhängig vom Setup-Lifecycle fortgeführt.
      for(const previous of continuing) {
        const snapshot=await repository.getSnapshot(previous.runId,previous.snapshotId);
        signal.throwIfAborted();
        if(!snapshot?.entry)continue;
        const record=evaluateSnapshot(snapshot);
        await repository.saveEntries(previous.runId,[record]);
        signal.throwIfAborted();
        stored.push(...record.outcomes.map(o=>({...o,runId:previous.runId,snapshotId:snapshot.id,
          instrument:snapshot.instrument,direction:snapshot.direction})));
      }
      const local=records.flatMap(({snapshot,outcomes})=>{
        snapshots.set(`${run.id}:${snapshot.id}`,snapshot);
        return outcomes.map(o=>({...o,runId:run.id,snapshotId:snapshot.id,instrument:snapshot.instrument,direction:snapshot.direction}));
      });
      signal.throwIfAborted();
      if(ticket!==revision)return;
      results.value=deduplicate([...local,...stored]);
      status.value='Setups speichern…';
      const savedRun={...run,progress:{entries:records.length,setups:found.length-records.length},
        coverage:{m1From:m1Candles[0]?.time ?? null,m1To:m1Candles.at(-1)?.time ?? null}};
      await repository.saveRun(savedRun);
      signal.throwIfAborted();
      await repository.saveSetups(run.id,found.filter(s=>!s.entry));
      signal.throwIfAborted();
      await repository.saveEntries(run.id,records);
      signal.throwIfAborted();
      // Erst nach allen Snapshots als vollständig markieren; fehlgeschlagene
      // Teilspeicherungen müssen beim Neuladen erneut berechnet werden.
      await repository.saveRun({...savedRun,progress:{...savedRun.progress,scanCompletedAt:at}});
      if(ticket===revision){completedScanKey=scanKey;status.value=`${records.length} Entries · gespeichert`;}
    } catch(e){if(!signal.aborted&&ticket===revision)error.value=e.message ?? 'Setup-Historie konnte nicht geladen werden.';}
    finally {if(ticket===revision){loading.value=false;if(refreshPending){refreshPending=false;void refresh();}}}
  }
  watch([checklist,()=>props.showTradeSetup2,()=>props.symbol,()=>props.tradeSetup2RunId],()=>refresh(),{immediate:true});
  watch(()=>[props.selectedTradeSetup2Id,props.tradeSetup2RunId],selectRoute);
  watch(()=>[props.symbol,props.replayUntil],()=>{abort?.abort();revision++;loading.value=false;});
  watch(()=>props.symbol,()=>{selectionRevision++;selected.value=null;results.value=[];});
  watch(()=>props.tradeSetup2HistoryCount,()=>refresh());
  watch([positions,visibleSnapshot,()=>props.showTradeSetup2],render);
  watch(()=>props.tradeSetup2Variant,()=>refresh());
  onScopeDispose(()=>{abort?.abort();revision++;selectionRevision++;chart?.unsubscribeClick(click);
    if(series)for(const list of [overview,details,entry])clearSetup2Primitives(series,list);series=null;});
  return {positions,selected:visibleSnapshot,loading,status,error,select,refresh:()=>refresh(true),
    create(c,s){chart=c;series=s;chart.subscribeClick(click);render();},
    updateCandles(rows){displayCandles.value=rows;render();}};
}

function deduplicate(rows) {
  const seen=new Map();
  for(const r of rows){const key=`${r.entryId}:${r.variant}`;const old=seen.get(key);
    if(!old||r.evaluatedAt>old.evaluatedAt)seen.set(key,r);}
  return [...seen.values()];
}
