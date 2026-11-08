import {it,expect,vi} from 'vitest';
import fixture from './fixtures/gbpusd-m5-cd-97-105.json';
import {partitionLiveSources,suspendedResumeTime} from '../services/setup2/recovery.js';
import {setupSourceKey} from '../src/setupSources.js';
import {SWEEP_RETEST_SOURCE_KIND} from '../src/sweepRetestSources.js';

const source=key=>({instrument:'XAUUSD',sourceKind:SWEEP_RETEST_SOURCE_KIND,sourceKey:key,recognizedAt:1800,
  orderBlockKnownAt:600,sourceRetest:{recognizedAt:1800}});
it('retains distinct generated sources and excludes only the suspended source identity',()=>{
  const first=source('first'),second=source('second');
  expect(partitionLiveSources([first,second,first])).toEqual([first,second]);
  expect(partitionLiveSources([first,second],[{setupKey:setupSourceKey(first)}])).toEqual([second]);
});
it('resumes generated sources from their own recognition time without legacy DB metadata',()=>{
  expect(suspendedResumeTime({source:source('first')})).toBe(1740);
  expect(suspendedResumeTime({source:source('first'),evaluatedThrough:1860})).toBe(1860);
  expect(()=>suspendedResumeTime({source:{...source('first'),orderBlockKnownAt:1860}})).toThrow('kausal');
  expect(()=>suspendedResumeTime({source:{...source('first'),sourceRetest:null}})).toThrow('kausal');
});
it('assembles before M1 fetch and persists a generated live source without a DB row',async()=>{
  vi.resetModules();
  const original=fixture.setups[0],closed=original.createdAt+1200;
  const generated={...original,sourceKind:SWEEP_RETEST_SOURCE_KIND,sourceKey:'generated',recognizedAt:closed-300,
    orderBlockKnownAt:original.createdAt,sourceRetest:{recognizedAt:closed-300}};
  delete generated.tradeSetupId;
  const key=setupSourceKey(generated),calls=[],checkpoints=[];
  const assemble=vi.fn(input=>{calls.push('assemble');expect(input).toMatchObject({includeSweepRetestSources:true,evaluatedAt:closed});return [generated];});
  vi.doMock('../src/setupSources.js',async importOriginal=>({...await importOriginal(),assembleSetupSources:assemble}));
  vi.doMock('../src/tradeSetup2Scan.js',()=>({scanTradeSetup2Window:vi.fn(async input=>{
    expect(input).toMatchObject({tradeSetups:[generated],sourcesAssembled:true,includeSweepRetestSources:true});
    await input.onSnapshot({setupKey:key,direction:'short',dealingRange:{status:'validated'},rangeCourse:{lifecycle:{main:{state:'active'}}}});
    return [];
  })}));
  const iso=t=>new Date(t*1000).toISOString();
  const bars={'1D':fixture.dailyCandles,'1h':fixture.h1Candles,'5m':[{time:closed-300,open:1,high:1,low:1,close:1}],'1m':[{time:closed-60,open:1,high:1,low:1,close:1}]};
  vi.stubGlobal('fetch',async(input,options={})=>{
    const url=new URL(input),table=url.pathname.split('/').at(-1),q=url.searchParams;let body=[];
    if(table==='setup2_acquire_lease')body=true;
    else if(table==='setup2_checkpoint'){checkpoints.push(JSON.parse(options.body));body=null;}
    else if(table==='setup2-notification-watch')body={};
    else if(Number(q.get('offset'))>0)body=[];
    else if(table==='setup2_live_state')body=[{instrument:'GBPUSD',enabled:true,state:{runtimeVersion:'live-minute-v2',evaluatedThrough:iso(closed-120)}}];
    else if(table==='trading_schedules')body=[{instrument:'GBPUSD',trading_windows:{weekday:[[0,1440]],saturday:[],sunday:[]}}];
    else if(table==='fxcm_candles'){
      const bar=q.get('bar').slice(3),from=Date.parse(q.get('time').slice(4))/1000;
      if(bar==='1m')calls.push('m1');
      body=bars[bar].filter(c=>c.time>=from).map(c=>({...c,time:iso(c.time)}));
    }
    return new Response(JSON.stringify(body),{status:200});
  });
  vi.stubEnv('SUPABASE_URL','https://watcher.test');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','local-test-key');
  vi.stubEnv('SETUP2_WATCH_TOKEN','local-test-watch');vi.stubEnv('WATCHER_ONCE','1');
  const clock=vi.spyOn(Date,'now').mockReturnValue((closed+20)*1000),log=vi.spyOn(console,'log').mockImplementation(()=>{});
  try{
    await import('../services/setup2/runner.mjs');
    expect(calls.indexOf('assemble')).toBeLessThan(calls.indexOf('m1'));
    expect(checkpoints).toHaveLength(1);
    expect(checkpoints[0].p_state.activeRanges).toMatchObject([{setupKey:key,source:generated}]);
    expect(checkpoints[0].p_state.error).toBeNull();
  }finally{
    clock.mockRestore();log.mockRestore();vi.doUnmock('../src/setupSources.js');vi.doUnmock('../src/tradeSetup2Scan.js');vi.unstubAllGlobals();vi.unstubAllEnvs();
  }
});
