import {beforeEach,expect,it,vi} from 'vitest';
import {effectScope,reactive,ref,nextTick} from 'vue';
vi.mock('../src/tradeSetup2Rendering.js',()=>({renderSetup2Positions:vi.fn(),renderSetup2Detail:vi.fn(),clearSetup2Primitives:vi.fn()}));
vi.mock('../src/tradeSetup2Configuration.js',()=>({buildTradeSetup2Configuration:x=>x,setup2DailyRun:async configuration=>({id:'chart:GBPUSD:day:key',configuration,from:0})}));
vi.mock('../src/forexCandles.js',()=>({fetchInitialCandles:vi.fn()}));
vi.mock('../src/candleCache.js',()=>({fetchCandlesCached:vi.fn()}));
vi.mock('../src/tradeSetup2BrowserScan.js',()=>({scanTradeSetup2InWorker:vi.fn()}));
vi.mock('../src/tradeSetupSimulation.js',()=>({evaluateSimulation:vi.fn(({entry,variant,evaluatedAt})=>({entryId:entry.id,entryTime:entry.recognizedAt,variant,evaluatedAt,status:'closed'}))}));
import {useTradeSetup2History} from '../src/composables/useTradeSetup2History.js';
import {scanTradeSetup2InWorker} from '../src/tradeSetup2BrowserScan.js';
import {fetchCandlesCached} from '../src/candleCache.js';

const flush=async()=>{for(let i=0;i<15;i++)await Promise.resolve();await nextTick();};
it('opens a candidate without an entry, exposes its checklist and focuses matching candles without scanning',async()=>{
  const props=reactive({showTradeSetup2:true,symbol:'GBPUSD',tradeSetup2Variant:'wide',tradeSetup2HistoryCount:5,
    tradeSetup2RunId:'run',selectedTradeSetup2Id:'candidate',currentBar:'5m',replayUntil:600});
  const snapshot={id:'candidate',setupKey:'candidate',instrument:'GBPUSD',direction:'short',knownAt:600,entry:null,evidence:[],
    checklist:{setup:{primary:{id:'candidate',recognizedAt:300}}}};
  const repository={getEntry:vi.fn(async()=>null),getSetupSnapshot:vi.fn(async()=>snapshot),listRuns:vi.fn()};
  const scope=effectScope(),focus=vi.fn();
  const view=scope.run(()=>useTradeSetup2History(props,ref(null),{repository,configurationInput:()=>({}),evaluationTime:()=>props.replayUntil}));
  try {
    view.create({subscribeClick:vi.fn(),unsubscribeClick:vi.fn(),timeScale:()=>({setVisibleLogicalRange:focus})},{});
    await flush();view.updateCandles([{time:0},{time:300},{time:600}],true);
    expect(view.selected.value.checklist).toEqual(snapshot.checklist);
    expect(view.positions.value[0]).toMatchObject({kind:'candidate',snapshotId:'candidate'});
    expect(view.linkedRendered.value).toBe(true);
    expect(focus).toHaveBeenCalledOnce();
    expect(repository.listRuns).not.toHaveBeenCalled();
    expect(scanTradeSetup2InWorker).not.toHaveBeenCalled();
    props.replayUntil=900;await flush();
    expect(repository.getSetupSnapshot).toHaveBeenCalledTimes(1);
  } finally {scope.stop();}
});
it('loads a linked entry after a simultaneous instrument and replay change, then focuses only ready candles',async()=>{
  const props=reactive({showTradeSetup2:false,symbol:'EURUSD',tradeSetup2Variant:'wide',tradeSetup2HistoryCount:5,
    tradeSetup2RunId:null,selectedTradeSetup2Id:null,currentBar:'1h',replayUntil:120});
  const snapshot={id:'entry',instrument:'GBPUSD',knownAt:300,evidence:[],entry:{}};
  const repository={listRuns:vi.fn(async()=>[{id:'research'}]),listResults:vi.fn(async()=>[]),listSetups:vi.fn(async()=>[]),
    getEntry:vi.fn(async()=>({snapshot,results:[]})),
    getSnapshot:vi.fn(async()=>snapshot),getSetupSnapshot:vi.fn()};
  const scope=effectScope(),chart={subscribeClick:vi.fn(),unsubscribeClick:vi.fn(),
    timeScale:()=>({setVisibleLogicalRange:focus})},focus=vi.fn();
  const view=scope.run(()=>useTradeSetup2History(props,ref(null),{repository,configurationInput:()=>({instrument:props.symbol}),
    evaluationTime:()=>props.replayUntil}));
  try {
    view.create(chart,{});
    Object.assign(props,{showTradeSetup2:true,symbol:'GBPUSD',replayUntil:300,currentBar:'1m',
      tradeSetup2RunId:'research',selectedTradeSetup2Id:'entry'});
    await flush();
    expect(repository.getEntry).toHaveBeenCalledWith('research','entry');
    expect(repository.listResults).not.toHaveBeenCalled();
    expect(view.selected.value?.id).toBe('entry');
    expect(view.loading.value).toBe(false);
    const candles=Array.from({length:6},(_,i)=>({time:i*60}));
    view.updateCandles(candles,false);
    expect(focus).not.toHaveBeenCalled();
    view.updateCandles(candles,true);
    expect(focus).toHaveBeenCalledWith({from:-45,to:55});
    view.updateCandles(candles,true);
    await view.refresh();
    expect(focus).toHaveBeenCalledTimes(1);
    props.replayUntil=240;await flush();
    expect(view.selected.value).toBeNull();
    expect(focus).toHaveBeenCalledTimes(1);
  } finally {scope.stop();}
});
beforeEach(()=>{
  vi.clearAllMocks();scanTradeSetup2InWorker.mockResolvedValue([]);
  fetchCandlesCached.mockResolvedValue([{time:0},{time:540}]);
});
it('opens the requested snapshot without loading unrelated history',async()=>{
  const props=reactive({showTradeSetup2:true,symbol:'GBPUSD',tradeSetup2Variant:'wide',tradeSetup2HistoryCount:5,
    tradeSetup2RunId:'research',selectedTradeSetup2Id:'entry',currentBar:'1m',replayUntil:300});
  const repository={listRuns:vi.fn(),listResults:vi.fn(),listSetups:vi.fn(),
    getEntry:vi.fn(async()=>({snapshot:{id:'entry',instrument:'GBPUSD',knownAt:300,evidence:[],entry:{}},results:[]}))};
  const scope=effectScope();
  const view=scope.run(()=>useTradeSetup2History(props,ref(null),{repository,configurationInput:()=>({}),evaluationTime:()=>300}));
  try {
    await flush();
    expect(view.loading.value).toBe(false);
    expect(view.selected.value?.id).toBe('entry');
    expect(repository.listRuns).not.toHaveBeenCalled();
    expect(repository.listResults).not.toHaveBeenCalled();
    expect(repository.listSetups).not.toHaveBeenCalled();
  } finally {scope.stop();}
});
it('opens a multi-instrument research snapshot without requiring live checklist data',async()=>{
  const props=reactive({showTradeSetup2:true,symbol:'GBPUSD',tradeSetup2Variant:'wide',tradeSetup2HistoryCount:5,
    tradeSetup2RunId:'research',selectedTradeSetup2Id:'entry',currentBar:'5m'});
  const horizon=ref(600),snapshot={id:'entry',instrument:'GBPUSD',knownAt:300,evidence:[],entry:{},m1Check:{evaluatedAt:300}};
  const repository={listRuns:vi.fn(async()=>[{id:'research',configuration:{instruments:['GBPUSD','EURUSD']}}]),
    getEntry:vi.fn(async()=>({snapshot,results:[{entryId:'entry',runId:'research',instrument:'GBPUSD',direction:'short',variant:'wide',entryTime:300,status:'open'}]})),
    listResults:vi.fn(async()=>[{entryId:'entry',runId:'research',instrument:'GBPUSD',direction:'short',variant:'wide',entryTime:300,status:'open'}]),
    listSetups:vi.fn(async()=>[]),getSnapshot:vi.fn(async()=>snapshot),getSetupSnapshot:vi.fn(),saveRun:vi.fn()};
  const scope=effectScope();
  const view=scope.run(()=>useTradeSetup2History(props,ref(null),{repository,configurationInput:()=>({instrument:props.symbol}),evaluationTime:()=>horizon.value}));
  try {
    await flush();
    expect(view.positions.value).toHaveLength(1);
    expect(view.selected.value.m1Check).toEqual({instrument:'GBPUSD',evaluatedAt:300});
    expect(snapshot.m1Check.instrument).toBeUndefined();
    expect(repository.saveRun).not.toHaveBeenCalled();
    horizon.value=240;
    expect(view.selected.value).toBeNull();
    expect(view.positions.value).toEqual([]);
    horizon.value=600;
    expect(view.selected.value.id).toBe(snapshot.id);
    await view.select(null);await view.refresh();
    expect(view.selected.value.id).toBe('entry');
    props.symbol='EURUSD';await flush();
    expect(view.selected.value).toBeNull();
  } finally {scope.stop();}
});

it('advances and rewinds raw linked outcomes without any new reads or checklist-triggered requests',async()=>{
  const props=reactive({showTradeSetup2:true,symbol:'GBPUSD',tradeSetup2Variant:'wide',tradeSetup2HistoryCount:5,
    tradeSetup2RunId:'run',selectedTradeSetup2Id:'entry',currentBar:'5m',replayUntil:300});
  const row={entryId:'entry',runId:'run',instrument:'GBPUSD',direction:'short',variant:'wide',entryTime:300,
    status:'closed',exitTime:540,exitRecognizedAt:600,exitPrice:1,pnlUsd:100,evaluatedAt:900};
  const repository={getEntry:vi.fn(async()=>({snapshot:{id:'entry',instrument:'GBPUSD',knownAt:300,evidence:[],entry:{}},results:[row]}))};
  const checklist=ref(null),scope=effectScope();
  const view=scope.run(()=>useTradeSetup2History(props,checklist,{repository,configurationInput:()=>({}),evaluationTime:()=>props.replayUntil}));
  try {
    await flush();expect(view.positions.value[0].isOpen).toBe(true);
    props.replayUntil=600;checklist.value={status:'loading'};await flush();
    checklist.value={status:'ready'};await flush();
    expect(view.positions.value[0]).toMatchObject({isOpen:false,pnlUsd:100});
    props.replayUntil=300;await flush();
    expect(view.positions.value[0]).toMatchObject({isOpen:true,pnlUsd:null});
    expect(repository.getEntry).toHaveBeenCalledTimes(1);
    expect(scanTradeSetup2InWorker).not.toHaveBeenCalled();
    await view.refresh();expect(repository.getEntry).toHaveBeenCalledTimes(2);
  } finally {scope.stop();}
});

function liveHarness(repository, replayUntil=600) {
  const props=reactive({showTradeSetup2:true,symbol:'GBPUSD',tradeSetup2Variant:'narrow',tradeSetup2HistoryCount:1,
    tradeSetup2RunId:null,selectedTradeSetup2Id:null,currentBar:'1m',replayUntil});
  const horizon=ref(600),checklist=ref({instrument:'GBPUSD',status:'ready',context:{h1Candles:[],m5Candles:[{time:0}]}});
  const scope=effectScope();
  const view=scope.run(()=>useTradeSetup2History(props,checklist,{repository,configurationInput:()=>({instrument:props.symbol}),evaluationTime:()=>horizon.value}));
  return {props,horizon,checklist,scope,view};
}
const oldRun=id=>({id:`chart:GBPUSD:${id}:key`,configuration:{instrument:'GBPUSD'},from:-86400});
const stored=(id,variant='wide',status='open')=>({entryId:id,snapshotId:id,runId:oldRun(id).id,instrument:'GBPUSD',
  direction:'short',variant,status,entryTime:60,entryPrice:2,evaluatedAt:120});
const savedSnapshot=id=>({id,instrument:'GBPUSD',direction:'short',knownAt:60,evidence:[],entry:{id,recognizedAt:60,
  scales:{wide:{targets:[{price:1}]},narrow:{targets:[{price:1}]}}}});
const repositoryFor=runs=>({listRuns:vi.fn(async()=>runs),listResults:vi.fn(async()=>[]),listSetups:vi.fn(async()=>[]),getSetupSnapshot:vi.fn(),getSnapshot:vi.fn(async(_run,id)=>savedSnapshot(id)),
  saveRun:vi.fn(async()=>{}),saveEntries:vi.fn(async()=>{}),saveSetups:vi.fn(async()=>{})});

it('continues both variants behind the display limit even when the selected narrow variant has closed',async()=>{
  const runs=Array.from({length:12},(_,i)=>oldRun(String(i))),repository=repositoryFor(runs);
  repository.listResults.mockImplementation(async({runId})=>{
    const id=runId.split(':')[2];return [stored(id,'narrow','closed'),stored(id)];
  });
  const {view,scope}=liveHarness(repository);
  try {
    await vi.waitFor(()=>expect(view.loading.value).toBe(false));
    expect(repository.listResults).toHaveBeenCalledTimes(12);
    expect(repository.listResults.mock.calls.every(([query])=>query.variant===undefined)).toBe(true);
    const continued=repository.saveEntries.mock.calls.filter(([id])=>id!== 'chart:GBPUSD:day:key');
    expect(continued).toHaveLength(12);
    expect(continued.every(([,records])=>records[0].outcomes.map(o=>o.variant).join(',')==='wide,narrow')).toBe(true);
    expect(view.positions.value).toHaveLength(1);
  } finally {scope.stop();}
});

it('does not let a late persistence response overwrite a newer refresh',async()=>{
  let release;
  const repository=repositoryFor([oldRun('old')]);
  repository.listResults.mockResolvedValue([stored('old')]);
  repository.saveEntries.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
  const {view,scope}=liveHarness(repository);
  try {
    await flush();expect(release).toBeTypeOf('function');
    repository.listResults.mockResolvedValue([stored('new','narrow','closed')]);
    await view.refresh();
    expect(view.positions.value.map(p=>p.snapshotId)).toEqual(['new']);
    release();await flush();
    expect(view.positions.value.map(p=>p.snapshotId)).toEqual(['new']);
  } finally {scope.stop();}
});

it('finishes an ongoing live scan before processing the newest pending minute',async()=>{
  let release;
  scanTradeSetup2InWorker.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
  const repository=repositoryFor([]),{view,scope,horizon,checklist}=liveHarness(repository,null);
  try {
    await flush();expect(release).toBeTypeOf('function');
    horizon.value=660;checklist.value={...checklist.value};await flush();
    horizon.value=720;checklist.value={...checklist.value};await flush();
    expect(scanTradeSetup2InWorker).toHaveBeenCalledTimes(1);
    expect(scanTradeSetup2InWorker.mock.calls[0][1].signal.aborted).toBe(false);
    release([]);await flush();await flush();
    expect(scanTradeSetup2InWorker).toHaveBeenCalledTimes(2);
    expect(scanTradeSetup2InWorker.mock.calls[1][0].toTime).toBe(720);
    expect(view.loading.value).toBe(false);
  } finally {scope.stop();}
});
it('loads a fully persisted prefix after reload without rescanning it',async()=>{
  const repository=repositoryFor([{id:'chart:GBPUSD:day:key',configuration:{instrument:'GBPUSD'},from:0,progress:{scanCompletedAt:600}}]);
  repository.listResults.mockResolvedValue([stored('saved','narrow','closed')]);
  const {view,scope}=liveHarness(repository);
  try {
    await flush();
    expect(view.positions.value[0].snapshotId).toBe('saved');
    expect(scanTradeSetup2InWorker).not.toHaveBeenCalled();
    expect(repository.saveRun).not.toHaveBeenCalled();
  } finally {scope.stop();}
});

it('loads and selects a saved candidate without a candle scan and hides it on rewind',async()=>{
  const repository=repositoryFor([{id:'chart:GBPUSD:day:key',configuration:{instrument:'GBPUSD'},from:0,progress:{scanCompletedAt:600}}]);
  repository.listSetups.mockResolvedValue([{id:'candidate',instrument:'GBPUSD',direction:'short',knownAt:300}]);
  const snapshot={id:'candidate',knownAt:300,instrument:'GBPUSD',direction:'short',entry:null,evidence:[],
    checklist:{setup:{primary:{invalidation:2,reactionRecognizedAt:300}}}};
  repository.getSetupSnapshot.mockResolvedValue(snapshot);
  const {view,scope,horizon}=liveHarness(repository);
  try {
    await flush();
    expect(view.positions.value[0]).toMatchObject({kind:'candidate',snapshotId:'candidate',bounds:[{price:2}]});
    await view.select('candidate','chart:GBPUSD:day:key');
    expect(view.selected.value.entry).toBeNull();
    expect(repository.getSnapshot).not.toHaveBeenCalled();
    expect(scanTradeSetup2InWorker).not.toHaveBeenCalled();
    horizon.value=299;
    expect(view.positions.value).toEqual([]);
    expect(view.selected.value).toBeNull();
  } finally {scope.stop();}
});
