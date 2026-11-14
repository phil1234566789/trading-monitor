import {expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({payload:null,writes:[]}));
vi.mock('../src/supabaseClient.js',()=>({supabase:{from(){
 const q={select:()=>q,eq:()=>q,upsert:(row,options)=>{state.writes.push({row,options});return q;},
  maybeSingle:async()=>({data:{id:17,payload:state.payload},error:null}),
  then:r=>Promise.resolve({error:null}).then(r)};return q;
}}}));
vi.mock('../supabase/functions/_shared/tradeSetupSourceSnapshot.js',()=>({assertTradeSetupSourceSnapshot:p=>p}));
import {ensureTradeSetupSourceSnapshot,readTradeSetupSourceSnapshot,captureCurrentTradeSetupSources} from '../src/tradeSetupSourceSnapshots.js';
const payload={sourceProfile:'profile',settingsHash:'hash',canonicalSetupKnownAt:3000,evaluationAsOf:3600,
 setup:{dir:1,obStartTime:2400}};
it('first-writes atomically and reads explicit frozen identities back',async()=>{
 state.payload=structuredClone(payload);state.writes=[];
 expect(await ensureTradeSetupSourceSnapshot(9,payload)).toBe(17);
 expect(state.writes[0].options.ignoreDuplicates).toBe(true);
 expect(state.writes[0].row).toEqual({trade_setup_id:9,payload});
 expect(await readTradeSetupSourceSnapshot(17)).toEqual(payload);
});
it('does not report success when a concurrent writer froze different evidence under the same key',async()=>{
 state.payload={...payload,setup:{...payload.setup,obStartTime:999}};
 await expect(ensureTradeSetupSourceSnapshot(9,payload)).rejects.toThrow(/Konflikt/);
});
it('fails typed captures without evaluation context before resolving any database identity',async()=>{
 state.writes=[];
 await expect(captureCurrentTradeSetupSources({sweepSourceProfile:'new'},'XAUUSD')).rejects.toThrow(/kontext/i);
 expect(await captureCurrentTradeSetupSources({dir:1},'XAUUSD')).toBeNull();
 expect(state.writes).toEqual([]);
});
