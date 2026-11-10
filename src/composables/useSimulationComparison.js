import { ref, computed, watch, onScopeDispose } from 'vue';
import { reviewGroups, filterReviewGroups, groupResults } from '../simulationRunComparison.js';
import {isLiveWatcherMonth,liveSourceMonth,liveMonthBounds} from '../liveWatcherMonth.js';
import { applySimulationCommission } from '../tradeSetupSimulationCosts.js';
import {sortSimulationRunsByExecution} from '../simulationRunPresentation.js';

export function useSimulationComparison(repository, filters, pins) {
  const runs = ref([]), datasets = ref(new Map()), loading = ref(false), error = ref('');
  const runListError=ref('');
  let revision = 0,disposed=false,liveOptions=null,liveRequest=null;
  const cachedDatasets=new Map(),cachedRuns=new Map();let options=null;
  const mergeRuns=rows=>sortSimulationRunsByExecution([...new Map(rows.map(row=>[row.id,row])).values()]);
  function enrichLiveRuns(){
    if(!repository.listLiveRuns||liveRequest)return;
    liveRequest=repository.listLiveRuns().then(rows=>{
      if(disposed)return;liveOptions=rows;runListError.value='';runs.value=mergeRuns([...runs.value,...rows]);
    }).catch(cause=>{if(!disposed)runListError.value='Live-Monate konnten nicht geladen werden: '+(cause.message??cause);liveRequest=null;});
  }
  async function refresh(force=true) {
    if(force){cachedDatasets.clear();cachedRuns.clear();options=null;}
    const ticket = ++revision; loading.value = true; error.value = '';
    try {
      // Die Laufwahl darf nicht auf optionale Live-Archive oder vollständige Prüfbelege warten.
      const available = options ?? await (repository.listRunOptions?.() ?? repository.listRuns());
      options=available;
      if (ticket !== revision) return;
      runs.value = mergeRuns([...available,...(liveOptions ?? [])]);
      enrichLiveRuns();
      if (!filters.value.run) {datasets.value=new Map();return;}
      const ids = [...new Set([filters.value.run, filters.value.compare].filter(Boolean))];
      if(repository.getRun)for(const id of ids){
        const requested=cachedRuns.get(id)??await repository.getRun(id);if(ticket!==revision)return;
        if(!requested)throw new Error('Der gewählte gespeicherte Lauf ist nicht mehr verfügbar.');
        runs.value=mergeRuns([...runs.value,requested]);
        if(requested.status==='complete')cachedRuns.set(id,requested);
      }
      const data=[];
      // Gleichzeitige JSONB-Abfragen konkurrieren um dasselbe knappe SQL-Zeitbudget.
      for(const id of ids){
        if(repository.listStatistics&&!isLiveWatcherMonth(id)){
          const prepared=cachedDatasets.get(id)??await repository.listStatistics(id);
          if(ticket!==revision)return;
          cachedDatasets.set(id,prepared);data.push([id,prepared]);continue;
        }
        const snapshots=await repository.listReviewMetadata(id);
        if(ticket!==revision)return;
        const results=await repository.listResults({runId:id});
        if(ticket!==revision)return;
        let groups=reviewGroups(snapshots);
        if(isLiveWatcherMonth(id)){const {from,to}=liveMonthBounds(liveSourceMonth(id));groups=groups.map(g=>({...g,entries:g.entries.filter(e=>e.knownAt>=Date.parse(from)/1000&&e.knownAt<Date.parse(to)/1000)}));}
        data.push([id,{groups,results:results.map(row=>row.status==='notStored'?row:applySimulationCommission(row))}]);
      }
      if(ticket!==revision)return;
      datasets.value=new Map(data);
      runs.value=runs.value.map(run=>({...run,dealingRangeCount:datasets.value.get(run.id)?.prepared?datasets.value.get(run.id).groups.length:run.dealingRangeCount}));
      // Zusatzanzahlen erst nach dem sichtbaren Lauf laden, ohne dessen Anzeige zu verzögern.
      const applyCounts=drCounts=>{
        if(ticket===revision)runs.value=runs.value.map(r=>({...r,dealingRangeCount:drCounts.get(r.id)??r.dealingRangeCount??null}));
      };
      if(repository.listStatisticsCounts){
        repository.listStatisticsCounts(available.filter(r=>!isLiveWatcherMonth(r.id)).map(r=>r.id)).then(applyCounts).catch(()=>{});
        repository.listRunDrCounts(available.filter(r=>isLiveWatcherMonth(r.id)).map(r=>r.id)).then(applyCounts).catch(()=>{});
      }else repository.listRunDrCounts(available.map(r=>r.id)).then(applyCounts).catch(()=>{});
    } catch (cause) { if (ticket === revision) error.value = cause.message || 'Simulationsdaten konnten nicht geladen werden.'; }
    finally { if (ticket === revision) loading.value = false; }
  }
  watch([()=>filters.value.run,()=>filters.value.compare],()=>refresh(false),{immediate:true});
  onScopeDispose(()=>{revision++;disposed=true;});
  const dateError = computed(()=>filters.value.from && filters.value.to && filters.value.from>filters.value.to ? 'Das Enddatum liegt vor dem Startdatum.' : '');
  function scoped(id) {
    const data=datasets.value.get(id);
    if (!data || dateError.value) return {groups:[],results:[]};
    const groups=filterReviewGroups(data.groups,filters.value,filters.value.pinned?pins.value:[]);
    return {groups,results:groupResults(groups,data.results,filters.value)};
  }
  return {runs,loading,error,runListError,dateError,refresh,datasets,
    selectedRun:computed(()=>runs.value.find(r=>r.id===filters.value.run)),
    comparisonRun:computed(()=>runs.value.find(r=>r.id===filters.value.compare)),
    current:computed(()=>scoped(filters.value.run)),previous:computed(()=>scoped(filters.value.compare))};
}
