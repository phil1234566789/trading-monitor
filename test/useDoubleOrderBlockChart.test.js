import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {useDoubleOrderBlockChart} from '../src/composables/useDoubleOrderBlockChart.js';
import {fetchCandlesCached} from '../src/candleCache.js';
import {renderDoubleOrderBlocks} from '../src/doubleOrderBlockRendering.js';
import {markIgnored} from '../src/ignoredCandles.js';
import {sessions} from '../src/sessions.js';
vi.mock('../src/forexCandles.js',()=>({fetchInitialCandles:vi.fn()}));
vi.mock('../src/candleCache.js',()=>({fetchCandlesCached:vi.fn()}));
vi.mock('../src/doubleOrderBlockRendering.js',()=>({renderDoubleOrderBlocks:vi.fn(()=>[]),hitDoubleOrderBlock:vi.fn(),doubleOrderBlockDetails:vi.fn(()=> '')}));
vi.mock('../src/sessions.js',async()=>({sessions:(await import('vue')).reactive([])}));
vi.mock('../src/ignoredCandles.js',()=>({markIgnored:vi.fn(rows=>rows.map(c=>({...c,ignored:true})))}));
const workers=[];
class WorkerMock {constructor(){this.terminate=vi.fn();this.postMessage=vi.fn();workers.push(this);}}
const context=()=>({enabled:true,snapshot:false,symbol:'XAUUSD',evaluatedAt:1200,candles:[{time:100}],series:{detachPrimitive:vi.fn()}});
beforeEach(()=>{sessions.splice(0);workers.length=0;vi.clearAllMocks();vi.stubGlobal('Worker',WorkerMock);fetchCandlesCached.mockResolvedValue([{time:100}]);});
afterEach(()=>vi.unstubAllGlobals());
it('loads native cached M5 and M1 without future lookahead, dedupes a pending request and detaches on disable',async()=>{
  const c=context(),a=useDoubleOrderBlockChart(()=>c);a.refresh();a.refresh();
  await vi.waitFor(()=>expect(workers).toHaveLength(1));
  expect(fetchCandlesCached).toHaveBeenCalledTimes(2);
  expect(fetchCandlesCached.mock.calls.map(c=>[c[2],c[4],c[5]])).toEqual([['5m',1200000,undefined],['1m',1200000,undefined]]);
  expect(workers[0].postMessage).toHaveBeenCalledWith(expect.objectContaining({instrument:'XAUUSD',evaluatedAt:1200}));
  expect(workers[0].postMessage.mock.calls[0][0]).toMatchObject({m5Candles:[{time:100,ignored:true}],m1Candles:[{time:100,ignored:true}]});
  expect(markIgnored).toHaveBeenCalledTimes(2);
  const primitive={};renderDoubleOrderBlocks.mockReturnValueOnce([{primitive}]);
  workers[0].onmessage({data:{result:{status:'ready',pairs:[{id:'pair'}]}}});
  c.enabled=false;a.refresh();expect(c.series.detachPrimitive).toHaveBeenCalledWith(primitive);expect(a.status.value).toBe('');a.dispose();
});
it('re-evaluates cached native rows when session ignore settings change without filtering out candles',async()=>{
  const c=context(),a=useDoubleOrderBlockChart(()=>c);a.refresh();await vi.waitFor(()=>expect(workers).toHaveLength(1));
  workers[0].onmessage({data:{result:{status:'ready',pairs:[]}}});
  sessions.push({instrument:'XAUUSD',ignoreLiquidity:true});await vi.waitFor(()=>expect(workers).toHaveLength(2));
  expect(workers[1].postMessage.mock.calls[0][0].m1Candles).toEqual([{time:100,ignored:true}]);
  expect(markIgnored).toHaveBeenCalledWith([{time:100}],'XAUUSD');a.dispose();
});
it('ignores stale results after a symbol change without terminating the new worker',async()=>{
  const c=context(),a=useDoubleOrderBlockChart(()=>c);a.refresh();await vi.waitFor(()=>expect(workers).toHaveLength(1));
  c.symbol='GBPUSD';a.refresh();await vi.waitFor(()=>expect(workers).toHaveLength(2));
  workers[0].onmessage({data:{result:{status:'ready',pairs:[{id:'old'}]}}});
  expect(workers[1].terminate).not.toHaveBeenCalled();expect(renderDoubleOrderBlocks).not.toHaveBeenCalled();
  workers[1].onmessage({data:{result:{status:'unknown',pairs:[]}}});expect(a.status.value).toContain('unvollständig');a.dispose();
});
it('does not evaluate snapshot charts and surfaces fetch failures so the next refresh can retry',async()=>{
  const c=context();c.snapshot=true;const a=useDoubleOrderBlockChart(()=>c);a.refresh();expect(fetchCandlesCached).not.toHaveBeenCalled();
  c.snapshot=false;fetchCandlesCached.mockRejectedValueOnce(new Error('offline'));a.refresh();
  await vi.waitFor(()=>expect(a.status.value).toContain('offline'));a.refresh();await vi.waitFor(()=>expect(workers).toHaveLength(1));a.dispose();
});
it.each(['1h','4h','1d'])('bounds native reads independently of years of visible %s candles and anchors them at replay as-of',async bar=>{
  const c=context();c.currentBar=bar;c.replayUntil=1200;c.candles=[{time:-2000000000}];
  const a=useDoubleOrderBlockChart(()=>c);a.refresh();await vi.waitFor(()=>expect(workers).toHaveLength(1));
  expect(fetchCandlesCached.mock.calls.map(c=>[c[2],c[3],c[4]])).toEqual([['5m',2500,1200000],['1m',12505,1200000]]);
  workers[0].onmessage({data:{result:{status:'ready',pairs:[]}}});
  expect(a.status.value).toContain('im Ausschnitt');expect(a.status.value).toContain('M5 ab');expect(a.status.value).toContain('M1 ab');
  c.candles=[{time:-3000000000}];a.refresh();expect(fetchCandlesCached).toHaveBeenCalledTimes(2);a.dispose();
});
it('renders the frozen pin and its as-of over a recomputed same-ID live loss',async()=>{
 const frozen={id:'same',entries:{a:{outcome:{status:'open'}}}},live={id:'same',entries:{a:{outcome:{status:'loss'}}}};
 const c=context();c.pinnedSnapshots=[{pair:frozen,evaluatedAt:900}];c.hoveredPin=c.pinnedSnapshots[0];
 const original=JSON.stringify(c.hoveredPin),a=useDoubleOrderBlockChart(()=>c);a.refresh();
 await vi.waitFor(()=>expect(workers).toHaveLength(1));workers[0].onmessage({data:{result:{status:'ready',pairs:[live]}}});
 const call=renderDoubleOrderBlocks.mock.calls.at(-1);expect(call[1]).toEqual([frozen]);expect(call[4].pairEvaluatedAt.get('same')).toBe(900);expect(JSON.stringify(c.hoveredPin)).toBe(original);a.dispose();
});
