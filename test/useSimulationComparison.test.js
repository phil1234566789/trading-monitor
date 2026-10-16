import {expect,it,vi} from 'vitest';
import {effectScope,ref,nextTick} from 'vue';
import {useSimulationComparison} from '../src/composables/useSimulationComparison.js';

it('lists runs by execution time without opening an unrequested dataset and preserves deep links',async()=>{
  const available=[{id:'legacy',status:'complete',evaluatedAt:9999},{id:'old',status:'complete',startedAt:100},
    {id:'new',status:'complete',completedAt:200},{id:'running',status:'running',startedAt:300}];
  for(const initial of [{run:'',compare:''},{run:'old',compare:'legacy'},{run:'missing',compare:'old'}]){
    const scope=effectScope(),filters=ref(initial),repository={listRuns:async()=>available,
      listReviewMetadata:vi.fn(async()=>[]),listResults:vi.fn(async()=>[]),listRunDrCounts:vi.fn(async()=>new Map([['new',57],['old',0]]))};
    const view=scope.run(()=>useSimulationComparison(repository,filters,ref([])));
    try{
      for(let i=0;i<15;i++)await nextTick();
      expect(view.runs.value.map(r=>r.id)).toEqual(['running','new','old','legacy']);
      expect(filters.value.run).toBe(initial.run);expect(filters.value.compare).toBe(initial.compare);
      if(initial.run){expect(repository.listReviewMetadata).toHaveBeenCalledWith(initial.run);expect(view.runs.value.find(r=>r.id==='new').dealingRangeCount).toBe(57);}
      else{expect(repository.listReviewMetadata).not.toHaveBeenCalled();expect(repository.listRunDrCounts).not.toHaveBeenCalled();}
    }finally{scope.stop();}
  }
});
it('opens the selected run while slow DR counts are still pending',async()=>{
  let resolveCounts;
  const scope=effectScope(),repository={listRuns:async()=>[{id:'new',status:'complete'}],listReviewMetadata:async()=>[],listResults:async()=>[],
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
it('loads JSONB datasets before background counts and serializes their outcome reads',async()=>{
 let resolveMetadata;const calls=[];
 const repository={listRuns:async()=>[{id:'run',status:'complete'}],listReviewMetadata:()=>{calls.push('metadata');return new Promise(resolve=>{resolveMetadata=resolve;});},
  listResults:async()=>{calls.push('results');return [];},listRunDrCounts:async()=>{calls.push('counts');return new Map();}};
 const scope=effectScope();scope.run(()=>useSimulationComparison(repository,ref({run:'run',compare:''}),ref([])));
 try{for(let i=0;i<5;i++)await nextTick();expect(calls).toEqual(['metadata']);resolveMetadata([]);
  for(let i=0;i<10;i++)await nextTick();expect(calls).toEqual(['metadata','results','counts']);
 }finally{scope.stop();}
});

it('offers stored runs and opens the selected deep link while live month discovery remains pending',async()=>{
 let resolveLive;const repository={listRunOptions:vi.fn(async()=>[{id:'saved',status:'complete'}]),listLiveRuns:vi.fn(()=>new Promise(resolve=>{resolveLive=resolve;})),
 listReviewMetadata:vi.fn(async()=>[]),listResults:vi.fn(async()=>[]),listRunDrCounts:vi.fn(async()=>new Map())};
 const scope=effectScope(),filters=ref({run:'',compare:''}),view=scope.run(()=>useSimulationComparison(repository,filters,ref([])));
 try{for(let i=0;i<10;i++)await nextTick();expect(view.runs.value.map(run=>run.id)).toEqual(['saved']);expect(view.loading.value).toBe(false);expect(repository.listReviewMetadata).not.toHaveBeenCalled();
 filters.value={run:'saved',compare:''};for(let i=0;i<15;i++)await nextTick();expect(view.datasets.value.has('saved')).toBe(true);expect(view.loading.value).toBe(false);expect(repository.listLiveRuns).toHaveBeenCalledTimes(1);
 resolveLive([{id:'live-watcher:2026-09',source:'live-watcher'}]);for(let i=0;i<5;i++)await nextTick();expect(view.runs.value.some(run=>run.id==='saved')).toBe(true);expect(view.runs.value.some(run=>run.id==='live-watcher:2026-09')).toBe(true);
 }finally{scope.stop();}
});
it('shows a run-list failure and keeps stored choices usable after optional live discovery fails',async()=>{
 for(const primary of [true,false]){
 const scope=effectScope(),repository={listRunOptions:async()=>{if(primary)throw new Error('run-list fixture failed');return [{id:'saved'}];},listLiveRuns:async()=>{throw new Error('live fixture failed');}},view=scope.run(()=>useSimulationComparison(repository,ref({run:'',compare:''}),ref([])));
 try{for(let i=0;i<10;i++)await nextTick();expect(view.loading.value).toBe(false);if(primary)expect(view.error.value).toBe('run-list fixture failed');else{expect(view.error.value).toBe('');expect(view.runListError.value).toContain('live fixture failed');expect(view.runs.value[0].id).toBe('saved');}}
 finally{scope.stop();}
 }
});
