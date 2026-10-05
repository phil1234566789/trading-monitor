import {expect,it,vi} from 'vitest';
import {effectScope,ref,nextTick} from 'vue';
import {useSimulationComparison} from '../src/composables/useSimulationComparison.js';

it('defaults by execution time in the existing completed-run flow and preserves explicit selections',async()=>{
  const available=[{id:'legacy',status:'complete',evaluatedAt:9999},{id:'old',status:'complete',startedAt:100},
    {id:'new',status:'complete',completedAt:200},{id:'running',status:'running',startedAt:300}];
  for(const initial of [{run:'',compare:''},{run:'old',compare:'legacy'},{run:'missing',compare:'old'}]){
    const scope=effectScope(),filters=ref(initial),repository={listRuns:async()=>available,
      listReviewSnapshots:vi.fn(async()=>[]),listResults:vi.fn(async()=>[]),listRunDrCounts:vi.fn(async()=>new Map([['new',57],['old',0]]))};
    const view=scope.run(()=>useSimulationComparison(repository,filters,ref([])));
    try{
      for(let i=0;i<15;i++)await nextTick();
      expect(view.runs.value.map(r=>r.id)).toEqual(['running','new','old','legacy']);
      expect(filters.value.run).toBe(initial.run||'new');expect(filters.value.compare).toBe(initial.compare);
      expect(repository.listReviewSnapshots).toHaveBeenCalledWith(initial.run||'new');
      expect(view.runs.value.find(r=>r.id==='new').dealingRangeCount).toBe(57);
    }finally{scope.stop();}
  }
});
it('opens the selected run while slow DR counts are still pending',async()=>{
  let resolveCounts;
  const scope=effectScope(),repository={listRuns:async()=>[{id:'new',status:'complete'}],listReviewSnapshots:async()=>[],listResults:async()=>[],
    listRunDrCounts:()=>new Promise(resolve=>{resolveCounts=resolve;})};
  const view=scope.run(()=>useSimulationComparison(repository,ref({run:'new',compare:''}),ref([])));
  try{
    for(let i=0;i<10;i++)await nextTick();
    expect(view.loading.value).toBe(false);expect(view.datasets.value.has('new')).toBe(true);
    expect(view.runs.value[0].dealingRangeCount).toBeUndefined();
    resolveCounts(new Map([['new',57]]));await nextTick();await nextTick();
    expect(view.runs.value[0].dealingRangeCount).toBe(57);
  }finally{scope.stop();}
});
