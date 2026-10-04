import {beforeEach,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tradeSetupProvenance,setup1Configuration} from '../supabase/functions/_shared/tradeSetupProvenance.js';
import {TRADE_SETUP_DETECTOR_VERSION as frontendVersion} from '../src/tradeSetup.js';
import {TRADE_SETUP_DETECTOR_VERSION as backendVersion} from '../supabase/functions/_shared/tradeSetup.ts';
import {tradeSetupFromRow} from '../src/tradeSetupRow.js';
const database=vi.hoisted(()=>({writes:[],existing:null}));
vi.mock('../src/supabaseClient.js',()=>({supabase:{from(table){
  const chain={select:()=>chain,eq:()=>chain,upsert:(row,options)=>{database.writes.push({table,row,options});return chain;},
    maybeSingle:async()=>({data:database.existing,error:null}),single:async()=>({data:{id:table==='ob_zones'?17:23},error:null})};return chain;
}}}));
import {findOrCreateTradeSetupId} from '../src/tradeIntake.js';
beforeEach(()=>{database.writes=[];database.existing=null;});

it('uses one detector version and a stable SHA-256 of the actual configuration',async()=>{
  expect(frontendVersion).toBe(backendVersion);
  const p=await tradeSetupProvenance({source:'live',detectorVersion:backendVersion,configuration:{b:2,a:1}});
  expect(p).toEqual({source:'live',detector_version:backendVersion,config_hash:createHash('sha256').update('{"a":1,"b":2}').digest('hex'),input_set_id:null});
  expect((await tradeSetupProvenance({source:'backfill',detectorVersion:backendVersion,configuration:{a:1,b:2}})).config_hash).toBe(p.config_hash);
  expect(await tradeSetupProvenance({source:'manual'})).toMatchObject({detector_version:null,config_hash:null,input_set_id:null});
  await expect(tradeSetupProvenance({source:'guessed'})).rejects.toThrow('source');
});

it('ignores evaluation time but distinguishes tuning, Gold scaling, sessions and unbounded close checks',async()=>{
  const sessions=[{fromMinutes:1380,toMinutes:0,days:[5,1],ignoreLiquidity:true},{fromMinutes:0,toMinutes:420,days:[1],ignoreLiquidity:false}];
  const config=(params,other=sessions)=>setup1Configuration({instrument:'GBPUSD',params,minGap:null,sessions:other,m5FractalPeriod:5,h1Source:'h1Fractals'});
  const hash=async configuration=>(await tradeSetupProvenance({source:'live',configuration})).config_hash;
  const first=await hash(config({maxSweepDistance:.002,nowTime:1}));
  expect(await hash(config({nowTime:2,maxSweepDistance:.002},[...sessions].reverse()))).toBe(first);
  expect(await hash(config({maxSweepDistance:30}))).not.toBe(first);
  expect(await hash(config({maxSweepDistance:.002,closeCheckMaxAgeSec:Infinity}))).not.toBe(await hash(config({maxSweepDistance:.002,closeCheckMaxAgeSec:null})));
  expect(await hash(config({maxSweepDistance:.002},[]))).not.toBe(first);
});

it('writes manual provenance and preserves the natural key',async()=>{
  const setup={dir:1,fractal:{price:1.35,pivotTime:1000},ls:{price:1.34,pivotTime:500,touchedTime:900},obTop:1.36,obBottom:1.33,obStartTime:1100,
    detectorVersion:frontendVersion,detectionConfiguration:{instrument:'GBPUSD',params:{maxSweepDistance:.002}}};
  expect(await findOrCreateTradeSetupId({setup,instrument:'GBPUSD',direction:'short'})).toBe(23);
  const write=database.writes.find(w=>w.table==='trade_setups');
  expect(write.row).toMatchObject({source:'manual',detector_version:frontendVersion,input_set_id:null});
  expect(write.row.config_hash).toMatch(/^[a-f0-9]{64}$/);
  expect(write.options.onConflict).toBe('instrument,direction,ob_start_time');
});

it('reads legacy rows without inferring provenance and retains new fields',()=>{
  expect(tradeSetupFromRow({direction:'short'})).toMatchObject({source:null,detectorVersion:null,configHash:null,inputSetId:null});
  expect(tradeSetupFromRow({direction:'short',source:'rebuild',detector_version:'old',config_hash:'hash',input_set_id:'set'}))
    .toMatchObject({source:'rebuild',detectorVersion:'old',configHash:'hash',inputSetId:'set'});
});

it('wires live/backfill writers and keeps old provenance even on upsert conflicts',()=>{
  const live=readFileSync('supabase/functions/poi-watcher/index.ts','utf8');
  const backfill=readFileSync('supabase/functions/trading-monitor-mcp/scripts/backfillTradeSetups.ts','utf8');
  expect(live).toContain("source: 'live'");expect(live).toContain('...setupProvenance');
  expect(backfill).toContain("source: 'backfill'");expect(backfill).toContain('Object.assign(row, setupProvenance)');
  const sql=readFileSync('supabase/migrations/20261004220000_trade_setup_provenance.sql','utf8');
  for(const field of ['source','detector_version','config_hash','input_set_id'])expect(sql).toContain(`NEW.${field} := OLD.${field}`);
  expect(sql).not.toMatch(/UPDATE\s+public\.trade_setups/i);expect(sql).not.toMatch(/DEFAULT|NOT NULL/);
});
