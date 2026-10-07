import {it,expect,vi} from 'vitest';
const fake=vi.hoisted(()=>({secondStarted:false,release:null}));
vi.mock('../scripts/tradeSetup2Archive.mjs',()=>({archiveClient:()=>({pages:async(table,query)=>{
 if(table==='setup2_live_state')return ['EURUSD','GBPUSD'].map(instrument=>({instrument,enabled:true,state:{}}));
 if(table==='fxcm_candles'){
  if(query.instrument==='eq.EURUSD' && query.bar==='eq.1D')await new Promise(resolve=>fake.release=resolve);
  if(query.instrument==='eq.GBPUSD' && query.bar==='eq.1D'){fake.secondStarted=true;fake.release?.();}
 }
 return [];
}})}));
it('a stalled instrument download does not block the other instrument pipeline',async()=>{
 vi.stubEnv('SUPABASE_URL','https://watcher.test');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','local-key');vi.stubEnv('SETUP2_WATCH_TOKEN','local-token');vi.stubEnv('WATCHER_ONCE','1');
 vi.stubGlobal('fetch',async url=>new Response(JSON.stringify(String(url).includes('setup2_acquire_lease')?true:null),{status:200}));
 const errors=vi.spyOn(console,'error').mockImplementation(()=>{});
 let timer;
 try {
  await Promise.race([import('../services/setup2/runner.mjs'),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Second instrument blocked')),1500);})]);
  expect(fake.secondStarted).toBe(true);
 }finally{clearTimeout(timer);errors.mockRestore();vi.unstubAllEnvs();vi.unstubAllGlobals();}
});
