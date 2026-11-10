import {it,expect,vi} from 'vitest';
import {ref,effectScope,nextTick} from 'vue';
import {useSimulationRangePage} from '../src/composables/useSimulationRangePage.js';
import {useSimulationRangeDetails} from '../src/composables/useSimulationRangeDetails.js';
const settle=async()=>{for(let i=0;i<10;i++)await nextTick();};
it('fetches 25 DRs, retains all-run totals and loads one detail only after opening',async()=>{
 const all=Array.from({length:31},(_,i)=>({key:`k${i}`,entries:[]})),groups=ref(all),run=ref('r'),dataset=ref({prepared:true,generation:'g'});
 const repository={getStatisticsPage:vi.fn(async(r,g,keys)=>all.filter(row=>keys.includes(row.key))),getStatisticsDetail:vi.fn(async(r,g,key)=>({key,fullDetail:true}))};
 const scope=effectScope();const view=scope.run(()=>({page:useSimulationRangePage(repository,run,dataset,groups),details:useSimulationRangeDetails(repository,run,dataset)}));
 try{await settle();expect(view.page.page.value).toHaveLength(25);expect(groups.value).toHaveLength(31);expect(repository.getStatisticsDetail).not.toHaveBeenCalled();
 await view.details.open(all[0]);await view.details.open(all[0]);expect(repository.getStatisticsDetail).toHaveBeenCalledTimes(1);expect(view.details.states.get('k0').group.fullDetail).toBe(true);
 await view.page.more();expect(view.page.page.value).toHaveLength(31);expect(repository.getStatisticsPage.mock.calls[1][2]).toHaveLength(6);
 groups.value=all.slice(20);await settle();expect(view.page.page.value).toHaveLength(11);
 }finally{scope.stop();}
});
it('discards a stale page and retries a failed detail without losing the list',async()=>{
 let resolve;const groups=ref([{key:'old',entries:[]}]),run=ref('old'),dataset=ref({prepared:true,generation:'g'});
 const repository={getStatisticsPage:vi.fn(r=>r==='old'?new Promise(done=>{resolve=done;}):Promise.resolve([{key:'new',entries:[]}])),getStatisticsDetail:vi.fn().mockRejectedValueOnce(new Error('failed')).mockResolvedValue({key:'new'})};
 const scope=effectScope(),view=scope.run(()=>({page:useSimulationRangePage(repository,run,dataset,groups),details:useSimulationRangeDetails(repository,run,dataset)}));
 try{run.value='new';groups.value=[{key:'new',entries:[]}];await settle();resolve([{key:'old',entries:[]}]);await settle();expect(view.page.page.value.map(g=>g.key)).toEqual(['new']);
 await view.details.open(groups.value[0]);expect(view.details.states.get('new').error).toBe('failed');await view.details.open(groups.value[0]);expect(view.details.states.get('new').group.key).toBe('new');
 }finally{scope.stop();}
});
