import {expect,it,vi} from 'vitest';
import {effectScope,ref,nextTick} from 'vue';
import {useSimulationComparison} from '../src/composables/useSimulationComparison.js';

it('defaults by execution time in the existing completed-run flow and preserves explicit selections',async()=>{
  const available=[{id:'legacy',status:'complete',evaluatedAt:9999},{id:'old',status:'complete',startedAt:100},
    {id:'new',status:'complete',completedAt:200},{id:'running',status:'running',startedAt:300}];
  for(const initial of [{run:'',compare:''},{run:'old',compare:'legacy'},{run:'missing',compare:'old'}]){
    const scope=effectScope(),filters=ref(initial),repository={listRuns:async()=>available,
      listReviewSnapshots:vi.fn(async()=>[]),listResults:vi.fn(async()=>[])};
    const view=scope.run(()=>useSimulationComparison(repository,filters,ref([])));
    try{
      for(let i=0;i<15;i++)await nextTick();
      expect(view.runs.value.map(r=>r.id)).toEqual(['running','new','old','legacy']);
      expect(filters.value.run).toBe(initial.run||'new');expect(filters.value.compare).toBe(initial.compare);
      expect(repository.listReviewSnapshots).toHaveBeenCalledWith(initial.run||'new');
    }finally{scope.stop();}
  }
});
