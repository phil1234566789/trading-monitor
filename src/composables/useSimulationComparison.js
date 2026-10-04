import { ref, computed, watch, onScopeDispose } from 'vue';
import { reviewGroups, filterReviewGroups, groupResults, latestCompletedRun } from '../simulationRunComparison.js';
import { applySimulationCommission } from '../tradeSetupSimulationCosts.js';

export function useSimulationComparison(repository, filters, pins) {
  const runs = ref([]), datasets = ref(new Map()), loading = ref(false), error = ref('');
  let revision = 0;
  async function refresh() {
    const ticket = ++revision; loading.value = true; error.value = '';
    try {
      const available = await repository.listRuns();
      if (ticket !== revision) return;
      runs.value = available.toSorted((a,b)=>(b.evaluatedAt ?? 0)-(a.evaluatedAt ?? 0));
      if (!filters.value.run) { filters.value = {...filters.value,run:latestCompletedRun(available)}; return; }
      const ids = [...new Set([filters.value.run, filters.value.compare].filter(Boolean))];
      const data = await Promise.all(ids.map(async id => {
        const [snapshots, results] = await Promise.all([repository.listReviewSnapshots(id), repository.listResults({runId:id})]);
        return [id,{ groups:reviewGroups(snapshots), results:results.map(applySimulationCommission) }];
      }));
      if (ticket === revision) datasets.value = new Map(data);
    } catch (cause) { if (ticket === revision) error.value = cause.message || 'Simulationsdaten konnten nicht geladen werden.'; }
    finally { if (ticket === revision) loading.value = false; }
  }
  watch(()=>[filters.value.run,filters.value.compare],refresh,{immediate:true});
  onScopeDispose(()=>{revision++;});
  const dateError = computed(()=>filters.value.from && filters.value.to && filters.value.from>filters.value.to ? 'Das Enddatum liegt vor dem Startdatum.' : '');
  function scoped(id) {
    const data=datasets.value.get(id);
    if (!data || dateError.value) return {groups:[],results:[]};
    const groups=filterReviewGroups(data.groups,filters.value,pins.value);
    return {groups,results:groupResults(groups,data.results,filters.value)};
  }
  return {runs,loading,error,dateError,refresh,datasets,
    selectedRun:computed(()=>runs.value.find(r=>r.id===filters.value.run)),
    comparisonRun:computed(()=>runs.value.find(r=>r.id===filters.value.compare)),
    current:computed(()=>scoped(filters.value.run)),previous:computed(()=>scoped(filters.value.compare))};
}
