import {it,expect} from 'vitest';
import {rolldown} from 'rolldown';
import path from 'node:path';
import {setup2ProfilingPlugin,createSetup2Profile} from '../scripts/setup2Profiling.mjs';

it('profiles nested functions and memo hits without changing values',async()=>{
  const bundle=await rolldown({input:'profile-test',plugins:[{name:'profile-fixture',
    resolveId:id=>id==='profile-test'?'\0profile-test':null,
    load:id=>id==='\0profile-test'?['setup2Memo.js','tradeSetupChecklistTimeBasis.js','incrementalOrderBlocks.js']
      .map(file=>`export * from ${JSON.stringify(path.resolve('src',file).replaceAll('\\','/'))};`).join('\n'):null},
    setup2ProfilingPlugin()]});
  const generated=await bundle.generate({format:'esm'});await bundle.close();
  // Ein einzelner Test-Entry verhindert Split-Chunks mit relativen data:-Imports.
  const chunks=generated.output.filter(c=>c.type==='chunk'&&c.isEntry);
  const profile=createSetup2Profile();globalThis.__setup2Profile=profile;
  try{
    for(const chunk of chunks){
      const core=await import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`);
      if(core.createSetup2Memo){const memo=core.createSetup2Memo();memo.set('known',3);
        expect(memo.get('known')).toBe(3);expect(memo.get('missing')).toBeUndefined();}
      if(core.closedChecklistCandles)expect(core.closedChecklistCandles([{time:0}],'5m',300)).toEqual([{time:0}]);
      if(core.createIncrementalOrderBlockDetector){const detect=core.createIncrementalOrderBlockDetector('5m');
        expect(detect([])).toEqual([]);expect(detect([])).toEqual([]);}
    }
    expect(profile.memo).toEqual({hits:1,misses:1});
    expect(profile.functions.closedChecklistCandles.calls).toBe(1);
    expect(profile.functions.detectIncrementalOrderBlocks.calls).toBe(2);
  }finally{delete globalThis.__setup2Profile;}
});
