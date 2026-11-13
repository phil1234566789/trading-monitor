import {it,expect,vi} from 'vitest';
import {createRenderer,defineComponent,h,nextTick,reactive} from 'vue';
import {useMmtStatistics} from '../src/composables/useMmtStatistics.js';
import {statisticsParameters} from '../supabase/functions/trading-monitor-mcp/mt5StatisticsContract.js';
const id='00000000-0000-0000-0000-000000000001';
const renderer=createRenderer({createElement:()=>({}),createText:()=>({}),createComment:()=>({}),insert(){},remove(){},setText(){},setElementText(){},parentNode(){},nextSibling(){},patchProp(){}});
const flush=async()=>{for(let i=0;i<8;i++)await nextTick();};
function mount(api){
 let state;const props=reactive({api,accounts:[{id}],account:''}),emit=vi.fn();
 const app=renderer.createApp(defineComponent({setup(){state=useMmtStatistics(props,emit);return()=>h('div');}}));app.mount({});
 return {state,props,emit,unmount:()=>app.unmount()};
}
it('renders saved statistics before broker refresh completes and only fetches the selected week',async()=>{
 let finish;const pending=new Promise(resolve=>{finish=resolve;});
 const api=vi.fn(async(action,params)=>{
  if(action==='history_refresh')return pending;
  if(action==='history_refresh_status')return {done:true};
  if(action==='statistics_summary')return {weeks:[{key:'2026-11-09'},{key:'2026-11-02'}],totals:{count:3}};
  if(action==='statistics_page')return {rows:[{id:params.week}],total:1,next_offset:null};
  throw new Error('unexpected '+action);
 });
 const {state,unmount}=mount(api);await flush();
 expect(state.page.value.rows).toEqual([{id:'2026-11-09'}]);expect(state.refreshing.value).toBe(true);
 state.selectedWeek.value='2026-11-02';await flush();
 expect(state.page.value.rows).toEqual([{id:'2026-11-02'}]);
 expect(api.mock.calls.filter(c=>c[0]==='history_refresh')).toHaveLength(1);
 expect(api.mock.calls.some(c=>c[0]==='history_page'||c[0]==='statistics_series')).toBe(false);
 finish({requests:[]});await flush();unmount();
});
it('rejects malformed filters and caps pages at the API boundary',()=>{
 expect(statisticsParameters({action:'statistics_page',account_ids:[id],week:'2026-11-09'})).toMatchObject({p_limit:100,p_week:'2026-11-09',p_account_ids:[id]});
 for(const extra of [{limit:101},{offset:-1},{account_ids:['bad']},{week:'2026-02-30'},{outcomes:['all']},{currency:'USD OR true'}]){
  expect(()=>statisticsParameters({action:'statistics_page',account_ids:[id],...extra})).toThrow();
 }
});
