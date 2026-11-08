import {it,expect,vi} from 'vitest';
import fixture from './fixtures/xauusd-dr121-exploratory-short.json';
import {detectSweepRetestSources} from '../src/sweepRetestSources.js';
import {setupSourceKey} from '../src/setupSources.js';
import {scanTradeSetup2Window} from '../src/tradeSetup2Scan.js';
import * as m5 from '../src/tradeSetupChecklistM5.js';
import * as targets from '../src/tradeSetupChecklistTargets.js';
import * as confluences from '../src/tradeSetupChecklistConfluences.js';
const at=clock=>Date.parse(`2026-10-29T${clock}:00+01:00`)/1000;

it('streams and resumes a generated source through the real P2 engine (synthetic common-gate acceptance)',async()=>{
  const source=detectSweepRetestSources({instrument:'XAUUSD',m5Candles:fixture.candles.m5,h1Candles:fixture.candles.h1,evaluatedAt:at('12:25')})
    .find(s=>s.obStartTime===at('06:40')&&s.sweeps.some(sweep=>sweep.level.price===4037.84));
  // Diese Testdoubles prüfen Transport/Resume, keine fachliche Freigabe der echten DR121-C/D.
  vi.spyOn(m5,'evaluateChecklistOuterM5').mockReturnValue({state:{trend:'downtrend'}});
  vi.spyOn(m5,'evaluateChecklistM5').mockReturnValue({structureReaction:{trend:'uptrend'}});
  vi.spyOn(targets,'evaluateChecklistTargets').mockReturnValue({status:'passed',direction:'short',selectedAt:at('12:10'),
    target1:{price:4023.05,knownAt:at('12:10')}});
  vi.spyOn(confluences,'evaluateChecklistConfluences').mockReturnValue({antiConfluences:{status:'clear',rules:[]},confluences:{status:'clear',rules:[]}});
  const input={instrument:'XAUUSD',tradeSetups:[source],sourcesAssembled:true,includeSweepRetestSources:true,
    m5Candles:fixture.candles.m5,h1Candles:fixture.candles.h1,m1Candles:fixture.candles.m1,
    dailyAnchors:[{knownAt:at('12:00'),pivotTime:at('09:50'),structureStartTime:fixture.candles.m5[0].time}],
    fromTime:at('12:10'),toTime:at('12:25'),sessionConfigs:[],news:[],newsLoadStatus:'ready',
    tradingWindows:{weekday:[[0,1440]],saturday:[],sunday:[]},checkpointIdentity:'synthetic-common-gates-native-p2-fixture',collectSnapshots:false};
  try{
    const streamed=[],abort=new AbortController();let resumeState;
    await expect(scanTradeSetup2Window({...input,signal:abort.signal,onSnapshot:s=>streamed.push(s),
      onCheckpoint:(progress,state)=>{resumeState=state();if(progress.evaluatedAt===at('12:20'))abort.abort();}})).rejects.toThrow();
    await scanTradeSetup2Window({...input,resumeState,onSnapshot:s=>streamed.push(s)});
    const entries=streamed.filter(s=>s.entry);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({setupKey:setupSourceKey(source),entry:{price:4034.12,recognizedAt:at('12:25'),positionSizeFactor:1}});
    expect(entries[0].evidence.some(e=>e.role==='structure'&&e.timeframe==='1m')).toBe(true);
  }finally{vi.restoreAllMocks();}
});
