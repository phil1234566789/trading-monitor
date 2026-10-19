import {it,expect,vi} from 'vitest';

it.each(['lease','candles'])('logs safe transport details from %s without adding them to incident state',async(stage)=>{
 vi.resetModules();
 const checkpoints=[];
 vi.stubGlobal('fetch',async(input,options={})=>{
  const table=new URL(input).pathname.split('/').at(-1);
  if((stage==='lease' && table==='setup2_acquire_lease') || (stage==='candles' && table==='fxcm_candles'))throw new TypeError('secret-value',{cause:{code:'UND_ERR_SOCKET',socket:{remoteAddress:'secret-value'}}});
  if(table==='setup2_acquire_lease')return new Response('true');
  if(table==='setup2_live_state')return new Response(JSON.stringify(!Number(new URL(input).searchParams.get('offset'))?[{instrument:'GBPUSD',enabled:true,state:{lastSuccessAt:'2026-10-19T04:00:00Z'}}]:[]));
  if(table==='setup2_checkpoint')checkpoints.push(JSON.parse(options.body));
  return new Response('[]');
 });
 vi.stubEnv('SUPABASE_URL','https://watcher.test');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','secret-value');vi.stubEnv('SETUP2_WATCH_TOKEN','secret-value');vi.stubEnv('WATCHER_ONCE','1');
 const error=vi.spyOn(console,'error').mockImplementation(()=>{});
 try{
  await import('../services/setup2/runner.mjs');
  const rows=error.mock.calls.map(([line])=>JSON.parse(line));
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({instrument:'GBPUSD',request:{phase:'response headers',category:'connection',code:'UND_ERR_SOCKET'}});
  expect(rows[0].error).toMatch(/response headers, request failed, \d+ms$/);
  expect(JSON.stringify(rows)).not.toContain('secret-value');
  if(stage==='lease')expect(checkpoints).toEqual([]);
  else {
   expect(checkpoints).toHaveLength(1);
   expect(checkpoints[0].p_state.error).toBe(rows[0].error);
   expect(checkpoints[0].p_events[0].payload).toEqual({message:rows[0].error,lastSuccessAt:'2026-10-19T04:00:00Z'});
   expect(JSON.stringify(checkpoints)).not.toContain('UND_ERR_SOCKET');
  }
 }finally{error.mockRestore();vi.unstubAllGlobals();vi.unstubAllEnvs();}
});
