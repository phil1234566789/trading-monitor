import {it,expect,vi} from 'vitest';
import {watcherFreshness} from '../supabase/functions/_shared/setup2Freshness.js';
import {partitionLiveSources,continuousHistory,recoveryConfig,recoveryMatches,recoverSuspendedRange,suspendedResumeTime,refreshRecoveredHistory} from '../services/setup2/recovery.js';
const mock=vi.hoisted(()=>({scan:null}));
vi.mock('../src/tradeSetup2Scan.js',()=>({scanTradeSetup2Window:(input)=>mock.scan(input)}));
vi.mock('../services/setup2/events.js',()=>({structureReady:()=>false,rememberStructure:()=>null,minuteAlarmEvents:minute=>[{id:`event-${minute.knownAt}`,kind:'trading',stage:3,payload:{}}]}));
const at=Date.parse('2026-10-14T10:00:00Z')/1000,iso=t=>new Date(t*1000).toISOString();
it('live excludes suspended raw and retained sources while preserving fresh sources',()=>{
 const a={instrument:'GBPUSD',tradeSetupId:1},b={instrument:'GBPUSD',tradeSetupId:2};
 expect(partitionLiveSources([a,b,a],[{setupKey:'GBPUSD:setup1:1'}])).toEqual([b]);
});
it('requires complete native history, including both endpoints and valid prices',()=>{
 const rows=[0,60,120].map(t=>({time:at+t,high:2,low:1}));
 expect(continuousHistory(rows,at,at+180,60)).toBe(true);
 expect(continuousHistory([rows[0],rows[2]],at,at+180,60)).toBe(false);
 expect(continuousHistory(rows.slice(1),at,at+180,60)).toBe(false);
 expect(continuousHistory(rows.slice(0,2),at,at+180,60)).toBe(false);
 expect(continuousHistory([{...rows[0],high:null},...rows.slice(1)],at,at+180,60)).toBe(false);
});
it('slow scans and a fresh process ping cannot make an old market watermark healthy',()=>{
 const now=(at+600)*1000,state={lastSuccessAt:iso(at+590),nextExpectedCheck:iso(at+660),scanDurationMs:500000,
  activeRanges:[{}],evaluatedThrough:iso(at),lastProcessAt:iso(at+599)};
 expect(watcherFreshness(state,true,now,true)).toMatchObject({stale:true,marketLagSeconds:600});
 expect(watcherFreshness({...state,evaluatedThrough:iso(at+540)},true,now,true).stale).toBe(false);
 expect(watcherFreshness({...state,nextExpectedCheck:iso(at)},true,now,false).stale).toBe(true);
 expect(watcherFreshness({...state,activeRanges:[],lastM5Time:at},true,now,true).stale).toBe(false);
 expect(watcherFreshness({...state,activeRanges:[],lastM5Time:at-300},true,now,true).stale).toBe(true);
});
function context(mode='active') {
 const sessions=[],schedules=[{instrument:'GBPUSD',trading_windows:{weekday:[[0,1440]],saturday:[],sunday:[]}}],news=[];
 const source={instrument:'GBPUSD',tradeSetupId:1,createdAt:at,obStartTime:at-600,ls:{touchedTime:at-60}};
 const range={setupKey:'GBPUSD:setup1:1',source,historyStart:at,suspendedAt:iso(at+180),evaluatedThrough:iso(at+60)};
 const state={version:'current',configFingerprint:recoveryConfig(sessions,schedules[0].trading_windows,news),
  suspendedRanges:[range,{setupKey:'other-suspended'}],activeRanges:[{setupKey:'other-active'}],entries:[{setupKey:'other-active',entry:{id:'existing'}}],
  structureKnownAt:{},evaluatedThrough:iso(at+240),lastSuccessAt:iso(at+240),nextExpectedCheck:iso(at+300)};
 const row={instrument:'GBPUSD',enabled:true,state};
 const now=structuredClone(row);if(mode==='race')now.state.evaluatedThrough=iso(at+480);
 if(mode==='disabled')now.enabled=false;if(mode==='replaced')now.state.suspendedRanges[0].source.tradeSetupId=99;
 if(mode==='changed-config')now.state.configFingerprint='other';
 const checkpoints=[],scanWindows=[];
 mock.scan=async input=>{scanWindows.push([input.fromTime,input.toTime]);
  input.onSnapshot({setupKey:range.setupKey,direction:'short',dealingRange:{status:'validated'},rangeCourse:{lifecycle:{main:{state:mode==='unknown'?'unknown':'active'}}}});
  input.onSnapshot({setupKey:range.setupKey,entry:{id:`entry-${input.toTime}`,recognizedAt:input.toTime}});
  input.onMinuteCheck({context:{setupKey:range.setupKey,direction:'short'},check:{conditions:{}},knownAt:input.toTime});
 };
 const data=[0,60,120,180,240,300].map(t=>({time:at+t,high:2,low:1}));
 const args={row,range,sessions,schedules,news,cache:{anchors:[{knownAt:at-60,structureStartTime:at-300}],h1:[]},yieldControl:vi.fn(async()=>{}),
  candles:vi.fn(async(_,bar,from)=>bar==='5m'?[{time:at,high:2,low:1},{time:at+300,high:2,low:1}]:from>at+300?[{time:at+360,high:2,low:1},{time:at+420,high:2,low:1}]:mode==='gap'?data.filter(c=>c.time!==at+60):data),
  readState:async()=>now,readConfig:async()=>mode==='config-race'?'other':state.configFingerprint,
  acquire:vi.fn(async()=>true),checkpoint:async(s,e)=>checkpoints.push({state:s,events:e}),release:vi.fn(async()=>{})};
 return {args,checkpoints,scanWindows,row};
}
it('a genuine unchanged gap cannot start a CPU recovery scan or take the live lease',async()=>{
 const c=context('gap');await recoverSuspendedRange(c.args);expect(c.scanWindows).toEqual([]);
 expect(c.args.acquire).not.toHaveBeenCalled();expect(c.checkpoints).toEqual([]);
});
it.each(['disabled','replaced','changed-config','config-race'])('recovery never resurrects removed or changed work: %s',async mode=>{
 const c=context(mode);await recoverSuspendedRange(c.args);expect(c.checkpoints).toEqual([]);expect(c.args.release).toHaveBeenCalledOnce();
});
it('native repair uses a short merge and preserves all live health and unrelated work',async()=>{
 const c=context();await recoverSuspendedRange(c.args);expect(c.checkpoints).toHaveLength(1);
 const {state,events}=c.checkpoints[0];expect(state.evaluatedThrough).toBe(c.row.state.evaluatedThrough);
 expect(state.lastSuccessAt).toBe(c.row.state.lastSuccessAt);expect(state.nextExpectedCheck).toBe(c.row.state.nextExpectedCheck);
 expect(state.suspendedRanges).toEqual([{setupKey:'other-suspended'}]);expect(state.activeRanges.map(r=>r.setupKey)).toEqual(['other-active',c.args.range.setupKey]);
 expect(state.entries.map(s=>s.entry.id)).toContain('existing');expect(events.every(e=>e.missed_reason.includes('Nachholung'))).toBe(true);
 expect(c.row.state.entries).toHaveLength(1);expect(c.args.release).toHaveBeenCalledOnce();
});
it('race minutes are caught up before activating a repaired range',async()=>{
 const c=context('race');await recoverSuspendedRange(c.args);expect(c.scanWindows).toEqual([[at+120,at+360],[at+420,at+480]]);
 expect(c.checkpoints[0].state.evaluatedThrough).toBe(iso(at+480));expect(c.checkpoints[0].events).toHaveLength(2);
});
it('further genuine gaps remain suspended and preserve their own watermark',async()=>{
 const c=context('unknown');await recoverSuspendedRange(c.args);
 expect(c.checkpoints[0].state.suspendedRanges.find(r=>r.setupKey===c.args.range.setupKey)).toMatchObject({evaluatedThrough:iso(at+60),historyProbeThrough:iso(at+360)});
 expect(c.checkpoints[0].state.activeRanges).toEqual([{setupKey:'other-active'}]);
});

it('a repaired native history invalidates stale live bars only under the next fresh live state',async()=>{
 const c=context();const oldBars=[{time:at,high:2,low:1},{time:at+120,high:2,low:1}];
 const cache={'1m':oldBars,'5m':[],m1Start:at,scanMemo:{old:true},entries:[{entry:{id:'keep'}}]};
 await recoverSuspendedRange(c.args);expect(cache['1m']).toBe(oldBars);
 const fresh=c.checkpoints[0].state;expect(fresh.nativeHistoryRevision).toBe(1);
 expect(refreshRecoveredHistory(cache,fresh)).toBe(true);expect(cache['1m']).toBeUndefined();expect(cache['5m']).toBeUndefined();
 expect(cache.scanMemo).toEqual({});expect(cache.entries[0].entry.id).toBe('keep');
 const loaded=await c.args.candles('GBPUSD','1m',at);cache['1m']=loaded;
 expect(continuousHistory(cache['1m'],at,at+180,60)).toBe(true);
 expect(refreshRecoveredHistory(cache,fresh)).toBe(false);expect(cache['1m']).toBe(loaded);
});
