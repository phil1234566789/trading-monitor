import {computed,onScopeDispose,ref,shallowRef,watch} from 'vue';
import {scanTradeSetup2InWorker} from '../tradeSetup2BrowserScan.js';
import {buildTradeSetup2Configuration,setup2DailyRun} from '../tradeSetup2Configuration.js';
import {evaluateSimulation} from '../tradeSetupSimulation.js';
import {tradeSetup2HistoryItems} from '../tradeSetup2HistoryItems.js';
import {restoreTradeSetup2Snapshot,isTradeSetup2SnapshotView} from '../tradeSetup2Snapshot.js';
import {createLinkedSnapshotReader} from '../tradeSetup2LinkedSnapshot.js';
import {simulationAsOf} from '../tradeSetupSimulationRepository.js';
import {fetchInitialCandles} from '../forexCandles.js';
import {fetchCandlesCached} from '../candleCache.js';
import {REPLAY_LOOKAHEAD_SEC,barSecondsFor} from '../timeframes.js';
import {renderSetup2Positions,renderSetup2Detail,clearSetup2Primitives} from '../tradeSetup2Rendering.js';
import {computeJumpViewport} from '../priceChartJumpToTime.js';
import {useSnapshotM1} from './useSnapshotM1.js';
import {SNAPSHOT_INDICATOR_PROPS} from '../tradeSetup2SnapshotIndicators.js';
import {renderStructurePivots,renderLowerStructure} from '../structureOverlay.js';
import {useSnapshotIndicators} from './useSnapshotIndicators.js';
import {renderPersistedZones} from '../orderBlocks.js';

export function useTradeSetup2History(props,checklist,{repository,configurationInput,evaluationTime}) {
  const results=shallowRef([]),candidates=shallowRef([]),selected=shallowRef(null),status=ref(''),error=ref('');
  const loading=ref(false),displayCandles=shallowRef([]);
  const linkedReady=ref(false),linkedRendered=ref(false),readLinkedSnapshot=createLinkedSnapshotReader(repository);
  let series=null,chart=null,abort=null,revision=0,selectionRevision=0,completedScanKey=null,appliedRouteKey=null;
  let activeInputKey=null,activeAt=null,refreshPending=false;
  let displayReady=false,focusedRouteKey=null;
  const overview=[],details=[],entry=[],m1Markers=[],h1Markers=[],m5Markers=[],obPrimitives=[],m1Lines=[],m5Lines=[];
  const snapshots=new Map();
  const positions=computed(()=>tradeSetup2HistoryItems(results.value.map(row=>simulationAsOf(row,evaluationTime())).filter(Boolean),candidates.value,{instrument:props.symbol,variant:props.tradeSetup2Variant,
    asOf:evaluationTime(),historyCount:props.tradeSetup2HistoryCount,candles:displayCandles.value}));
  const visibleSnapshot=computed(()=>props.showTradeSetup2 && selected.value?.instrument===props.symbol
    && selected.value.knownAt<=evaluationTime()?selected.value:null);
  const snapshotM1=useSnapshotM1(props,visibleSnapshot,repository,undefined,evaluationTime);
  const snapshotIndicators=useSnapshotIndicators(props,visibleSnapshot,repository,undefined,evaluationTime);
  function render() {
    if(!series)return;
    renderSetup2Positions(series,props.showTradeSetup2?positions.value:[],overview,displayCandles.value,props.currentBar,visibleSnapshot.value?.id);
    const reconstructed=!!snapshotM1.value.result && !!visibleSnapshot.value && props.showM1Structure && ['1m','5m'].includes(props.currentBar);
    const m5Result=snapshotIndicators.value.m5;
    renderSetup2Detail(series,visibleSnapshot.value,details,entry,displayCandles.value,props.currentBar,evaluationTime(),
      {...props,dynamicStructure:[...(reconstructed?['1m']:[]),...(m5Result?['5m']:[])]});
    // Die Struktur folgt dem Replay; die gespeicherte Checkliste bleibt der Beleg.
    for(const [timeframe,result,lines,markers,show] of [['1m',reconstructed?snapshotM1.value.result:null,m1Lines,m1Markers,props.showM1Structure],
      ['5m',m5Result,m5Lines,m5Markers,props.showM5Structure]]) {
      const closedDisplay=displayCandles.value.filter(c=>c.time+barSecondsFor(props.currentBar)<=evaluationTime());
      renderLowerStructure(series,result,lines,markers,closedDisplay,{symbol:props.symbol,replayUntil:evaluationTime(),
        show:!!visibleSnapshot.value&&show,debug:!!visibleSnapshot.value&&show&&props.showLiquidityDebug,barSeconds:barSecondsFor(timeframe),timeframe});
    }
    for(const [bar,markers,show] of [['1h',h1Markers,props.showRanges],['5m',m5Markers,props.showM5Structure]]) {
      if(bar==='5m'&&m5Result)continue;
      renderStructurePivots(series,snapshotIndicators.value.pivots[bar],markers,displayCandles.value,
        {symbol:props.symbol,debug:!!visibleSnapshot.value&&show&&props.showLiquidityDebug});
    }
    const reaction=visibleSnapshot.value?.checklist?.setup?.primary?.reactionOB;
    renderPersistedZones(series,snapshotIndicators.value.zones.filter(z=>!(z.timeframe==='5M'&&z.startTime===reaction?.startTime
      &&z.top===reaction.top&&z.bottom===reaction.bottom)),obPrimitives,displayCandles.value);
    linkedRendered.value=linkedReady.value&&displayReady;
    const snapshot=visibleSnapshot.value;
    const key=`${props.tradeSetup2RunId}:${snapshot?.id}:${props.currentBar}`;
    if(chart&&displayReady&&snapshot?.id===props.selectedTradeSetup2Id&&props.tradeSetup2RunId&&key!==focusedRouteKey) {
      const viewport=computeJumpViewport(displayCandles.value,snapshot.knownAt,null,null);
      if(viewport){chart.timeScale().setVisibleLogicalRange(viewport);focusedRouteKey=key;}
    }
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
      if(Number.isFinite(evaluationTime())&&snapshot?.knownAt>evaluationTime()) error.value='Dieses Setup war am Replay-Stand noch nicht bekannt.';
      const restored=cached ?? restoreTradeSetup2Snapshot(snapshot);
      if(restored)snapshots.set(key,restored);
      selected.value=restored;
      if(!snapshot)error.value='Der gespeicherte Setup-Stand fehlt.';
    } catch(e){if(ticket===selectionRevision)error.value=e.message;}
  }
  function click({point}) {
    if(!point || !props.showTradeSetup2)return;
    const match=overview.filter(p=>p.historyItem||p.trade).map(p=>({p,d:p.historyItem?p.distanceTo(point.x,point.y):p.lineDistanceTo(point.x,point.y)})).filter(x=>x.d<10).sort((a,b)=>a.d-b.d)[0];
    const item=match&&(match.p.historyItem||match.p.trade);
    if(item)void select(item.snapshotId,item.runId);
  }
  async function selectRoute() {
    if(isTradeSetup2SnapshotView(props))return;
    const id=props.selectedTradeSetup2Id,run=props.tradeSetup2RunId,key=id&&run?`${run}:${id}`:null;
    if(key===appliedRouteKey)return;
    appliedRouteKey=key;
    if(key)await select(id,run);
    else await select(null);
  }
  async function refresh(force=false) {
    if(!props.showTradeSetup2){abort?.abort();revision++;loading.value=false;return;}
    if(isTradeSetup2SnapshotView(props)) {
      const ticket=++revision;
      loading.value=true;error.value='';status.value='Gespeichertes Setup laden…';linkedReady.value=false;
      try {
        const record=await readLinkedSnapshot(props.tradeSetup2RunId,props.selectedTradeSetup2Id,force);
        if(ticket!==revision)return;
        selected.value=restoreTradeSetup2Snapshot(record.snapshot);
        results.value=record.results;
        candidates.value=record.snapshot.entry?[]:[{...selected.value,runId:props.tradeSetup2RunId,snapshot:selected.value}];
        linkedReady.value=true;status.value='Gespeichertes Setup geladen';render();
      } catch(e){if(ticket===revision)error.value=e.message;}
      finally{if(ticket===revision)loading.value=false;}
      return;
    }
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
      const stored=[],storedCandidates=[];
      for(const r of props.tradeSetup2RunId?relevant.filter(r=>r.id===props.tradeSetup2RunId):relevant) {
        stored.push(...await repository.listResults({runId:r.id,instrument:props.symbol,asOf:at}));
        signal.throwIfAborted();
        storedCandidates.push(...(await repository.listSetups({runId:r.id,instrument:props.symbol}))
          .filter(c=>c.knownAt<=at).map(c=>({...c,runId:r.id})));
        signal.throwIfAborted();
      }
      results.value=deduplicate(stored);
      candidates.value=storedCandidates;
      // Nur die gemeinsam begrenzte Auswahl benötigt volle Zeichnungsdaten.
      for(const item of positions.value.filter(p=>p.kind==='candidate')) {
        const key=`${item.runId}:${item.snapshotId}`;
        const snapshot=snapshots.get(key) ?? restoreTradeSetup2Snapshot(await repository.getSetupSnapshot(item.runId,item.snapshotId));
        signal.throwIfAborted();
        if(snapshot?.knownAt<=at)snapshots.set(key,snapshot);
      }
      candidates.value=storedCandidates.map(c=>({...c,snapshot:snapshots.get(`${c.runId}:${c.id}`)}));
      const storedStatus=`${positions.value.length} gespeicherte Setups in dieser Ansicht`;
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
      let m1Candles=[];
      const loadM1Candles=async ({fromTime,structureFromTime=fromTime})=>{
        // Erst validierte DRs lösen den Abruf aus; P5 benötigt zusätzlich seinen bestehenden Vorlauf.
        fromTime=Math.min(fromTime,structureFromTime,...continuing.map(r=>r.entryTime));
        m1Candles=await fetchCandlesCached(fetchInitialCandles,props.symbol,'1m',Math.ceil((at-fromTime)/60)+11,at*1000,REPLAY_LOOKAHEAD_SEC);
        return m1Candles;
      };
      if(state.model!=='countertrend' || continuing.length) await loadM1Candles({fromTime:state.model==='countertrend'
        ? Math.min(...continuing.map(r=>r.entryTime)) : start});
      signal.throwIfAborted();
      const existingEntries=[];
      if(state.model==='countertrend') for(const previous of continuing) {
        const snapshot=await repository.getSnapshot(previous.runId,previous.snapshotId);
        signal.throwIfAborted();
        if(snapshot?.entry)existingEntries.push(snapshot);
      }
      const found=await scanTradeSetup2InWorker({...input,h1Candles:state.context.h1Candles,m5Candles:state.context.m5Candles,m1Candles,
        ...(state.model==='countertrend'?{tradeSetups:props.dbTradeSetups ?? [],dailyAnchors:state.context.dailyAnchors ?? []}:{}),
        fromTime:run.from,toTime:at,existingEntries,lazyM1:state.model==='countertrend'},{signal,loadM1Candles,
        onProgress:p=>{if(ticket===revision)status.value=`Setups auswerten: ${p.completed}/${p.total}`;}});
      signal.throwIfAborted();
      const courses=new Map(found.filter(s=>s.rangeCourse).map(s=>[s.setupKey,s.rangeCourse]));
      const evaluateSnapshot=snapshot=>({snapshot,outcomes:['wide','narrow'].map(variant=>
        evaluateSimulation({entry:snapshot.entry,variant,candles:m1Candles,evaluatedAt:at,
          target1:snapshot.entry.scales[variant].targets[0]?.price,target2:snapshot.entry.scales[variant].targets[1]?.price ?? null}))});
      const records=found.filter(s=>s.entry).map(evaluateSnapshot);
      // Der Tageswechsel beendet keine Position. Bereits gespeicherte Entries
      // behalten ihren Ursprungslauf und werden unabhängig vom Setup-Lifecycle fortgeführt.
      for(const previous of continuing) {
        const snapshot=existingEntries.find(s=>s.id===previous.snapshotId) ?? await repository.getSnapshot(previous.runId,previous.snapshotId);
        signal.throwIfAborted();
        if(!snapshot?.entry)continue;
        const record=evaluateSnapshot(courses.has(snapshot.setupKey)
          ? {...snapshot,rangeCourse:courses.get(snapshot.setupKey)} : snapshot);
        await repository.saveEntries(previous.runId,[record]);
        signal.throwIfAborted();
        stored.push(...record.outcomes.map(o=>({...o,runId:previous.runId,snapshotId:snapshot.id,
          setupKey:snapshot.setupKey,instrument:snapshot.instrument,direction:snapshot.direction})));
      }
      const local=records.flatMap(({snapshot,outcomes})=>{
        snapshots.set(`${run.id}:${snapshot.id}`,snapshot);
        return outcomes.map(o=>({...o,runId:run.id,snapshotId:snapshot.id,setupKey:snapshot.setupKey,instrument:snapshot.instrument,direction:snapshot.direction}));
      });
      signal.throwIfAborted();
      if(ticket!==revision)return;
      results.value=deduplicate([...local,...stored]);
      candidates.value=[...candidates.value,...found.filter(s=>!s.entry).map(snapshot=>{
        snapshots.set(`${run.id}:${snapshot.id}`,snapshot);
        return {...snapshot,runId:run.id,snapshot};
      })];
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
      if(ticket===revision){completedScanKey=scanKey;status.value=`${positions.value.length} Setups in dieser Ansicht · gespeichert`;}
    } catch(e){if(!signal.aborted&&ticket===revision)error.value=e.message ?? 'Setup-Historie konnte nicht geladen werden.';}
    finally {if(ticket===revision){loading.value=false;if(refreshPending){refreshPending=false;void refresh();}}}
  }
  // Erst alte Anfragen entwerten, danach den neuen Kontext laden. Andernfalls
  // bricht ein Instrument-/Replaywechsel seinen gerade gestarteten Request ab.
  watch(()=>[props.symbol,props.replayUntil],()=>{
    if(!isTradeSetup2SnapshotView(props)){abort?.abort();revision++;loading.value=false;}
    displayReady=false;linkedRendered.value=false;
  },{flush:'sync'});
  watch(()=>props.symbol,()=>{selectionRevision++;selected.value=null;results.value=[];candidates.value=[];appliedRouteKey=null;focusedRouteKey=null;},{flush:'sync'});
  watch([()=>isTradeSetup2SnapshotView(props)?null:checklist.value,()=>props.showTradeSetup2,()=>props.symbol,
    ()=>props.tradeSetup2RunId,()=>props.selectedTradeSetup2Id,()=>isTradeSetup2SnapshotView(props)?null:props.replayUntil],()=>refresh(),{immediate:true});
  // Den angefragten Snapshot direkt laden; die übrige Historie darf den Link nicht aufhalten.
  watch(()=>[props.selectedTradeSetup2Id,props.tradeSetup2RunId],selectRoute,{immediate:true});
  watch(()=>props.tradeSetup2HistoryCount,()=>{if(!isTradeSetup2SnapshotView(props))void refresh();});
  watch([positions,visibleSnapshot,snapshotM1,snapshotIndicators,()=>props.showTradeSetup2,()=>props.showLiquidityDebug,
    ...SNAPSHOT_INDICATOR_PROPS.map(key=>()=>props[key])],render);
  watch(()=>props.tradeSetup2Variant,()=>{if(!isTradeSetup2SnapshotView(props))void refresh();});
  onScopeDispose(()=>{abort?.abort();revision++;selectionRevision++;chart?.unsubscribeClick(click);
    if(series)for(const list of [overview,details,entry,m1Markers,h1Markers,m5Markers,obPrimitives,m1Lines,m5Lines])clearSetup2Primitives(series,list);series=null;});
  return {positions,selected:visibleSnapshot,snapshotM1,snapshotIndicators,loading,status,error,linkedReady,linkedRendered,select,refresh:()=>refresh(true),
    create(c,s){chart=c;series=s;chart.subscribeClick(click);render();},
    updateCandles(rows,ready=true){displayCandles.value=rows;displayReady=ready;render();}};
}

function deduplicate(rows) {
  const seen=new Map();
  for(const r of rows){const key=`${r.entryId}:${r.variant}`;const old=seen.get(key);
    if(!old||r.evaluatedAt>old.evaluatedAt)seen.set(key,r);}
  return [...seen.values()];
}
