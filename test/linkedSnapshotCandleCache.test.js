import {afterEach,expect,it,vi} from 'vitest';
import {effectScope,reactive,nextTick} from 'vue';
import {fetchCandlesCached} from '../src/candleCache.js';
import {usePriceChartChecklist} from '../src/composables/usePriceChartChecklist.js';
import {useTradeSetup2History} from '../src/composables/useTradeSetup2History.js';
vi.mock('../src/tradeSetup2Rendering.js',()=>({renderSetup2Positions:vi.fn(),renderSetup2Detail:vi.fn(),clearSetup2Primitives:vi.fn()}));
vi.mock('../src/tradeSetup2BrowserScan.js',()=>({scanTradeSetup2InWorker:vi.fn()}));
vi.mock('../src/forexCandles.js',()=>({fetchInitialCandles:vi.fn()}));
vi.mock('../src/supabaseClient.js',()=>({supabase:{}}));
vi.mock('../src/sessions.js',()=>({sessions:[]}));
const candle=time=>({time,open:1.33,high:1.34,low:1.32,close:1.33});
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();await nextTick();};
afterEach(()=>vi.unstubAllGlobals());

it('opens both DR links and switches back using verified candle windows, without refresh or cache deletion',async()=>{
  let stored;
  vi.stubGlobal('indexedDB',{open(){const request={};queueMicrotask(()=>{
    request.result={transaction(){const tx={objectStore:()=>({
      get(){const read={};queueMicrotask(()=>{read.result=stored;read.onsuccess();});return read;},
      put(value){stored=value;queueMicrotask(()=>tx.oncomplete());},
    })};return tx;}};request.onsuccess();});return request;}});
  const run='setup2-2fdbdff3d17aa395319105f2';
  const cases=[[2653,1781762940,1781763900],[2909,1786002180,1786009500]].map(([number,entryTime,replay])=>{
    const setupKey=`GBPUSD:GBPUSD:setup1:${number}`,id=`${setupKey}:countertrend-entry-model-1-v10:${entryTime}`;
    const primary={id:setupKey,sweep:{level:{price:1.33183}},reactionOB:{top:1.33192,bottom:1.33158}};
    const snapshot={id,setupKey,instrument:'GBPUSD',direction:'short',knownAt:entryTime+60,entry:{candleTime:entryTime,recognizedAt:entryTime+60},
      checklist:{setup:{primary}},evidence:[]};
    return {replay,snapshot,results:[{entryId:id,snapshotId:id,runId:run,setupKey,instrument:'GBPUSD',direction:'short',variant:'wide',entryTime,status:'open'}]};
  });
  const fetch=vi.fn(async(_symbol,_bar,count,toMs)=>Array.from({length:count},(_,i)=>candle(Math.floor(toMs/300000)*300-(count-1-i)*300)));
  // Zwei echte frühere Abrufe verschieben den skalaren Watermark über ungelesene Zeiträume.
  await fetchCandlesCached(fetch,'GBPUSD','5m',1000,(cases[0].replay-3*86400)*1000);
  await fetchCandlesCached(fetch,'GBPUSD','5m',1000,(cases[1].replay+10*86400)*1000);
  fetch.mockClear();
  const repository={getEntry:vi.fn(async(_run,id)=>cases.find(c=>c.snapshot.id===id)),getRangeEntries:vi.fn(async(_run,key)=>cases.filter(c=>c.snapshot.setupKey===key))};
  const props=reactive({symbol:'GBPUSD',currentBar:'5m',showTradeSetup2:true,tradeSetup2RunId:run,
    selectedTradeSetup2Id:cases[0].snapshot.id,replayUntil:cases[0].replay,tradeSetup2Variant:'',tradeSetup2HistoryCount:5});
  const scope=effectScope(),focus=vi.fn();
  const {checklist,view}=scope.run(()=>{const checklist=usePriceChartChecklist(props,reactive([]),()=>{});
    return {checklist,view:useTradeSetup2History(props,checklist.state,{repository,configurationInput:()=>({}),evaluationTime:checklist.evaluationTime})};});
  view.create({subscribeClick(){},unsubscribeClick(){},timeScale:()=>({setVisibleLogicalRange:focus})},{});
  try{
    for(const item of [cases[0],cases[1],cases[0]]){
      Object.assign(props,{selectedTradeSetup2Id:item.snapshot.id,replayUntil:item.replay});await flush();
      const candles=await fetchCandlesCached(fetch,'GBPUSD','5m',1000,item.replay*1000,6000);
      checklist.setChartCandles(candles,'GBPUSD:5m');view.updateCandles(candles);await flush();
      expect(checklist.evaluationTime()).toBe(Math.floor(item.replay/300)*300+300);
      expect(view.positions.value).toHaveLength(1);
      expect(view.selected.value?.checklist.setup.primary).toEqual(item.snapshot.checklist.setup.primary);
      expect(focus).toHaveBeenCalled();
    }
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(repository.getEntry).toHaveBeenCalledTimes(2);
  }finally{scope.stop();}
});
