import {it,expect,vi} from 'vitest';
const {scan}=vi.hoisted(()=>({scan:vi.fn()}));
vi.mock('../src/tradeSetup2Scan.js',()=>({scanTradeSetup2Window:scan}));
vi.mock('../services/setup2/evidence.js',()=>({createLiveEvidence:()=>({configurationId:'test',record(){},recordMinute(){},complete:()=>({snapshots:[],priceState:{}})})}));
import {recoverSuspendedRange,recoveryConfig,refreshRecoveredHistory} from '../services/setup2/recovery.js';
import {naturalSourceFamilyKey} from '../src/setupSourceFamily.js';
const iso=t=>new Date(t*1000).toISOString();
const source={instrument:'XAUUSD',tradeSetupId:'alias',createdAt:2400,dir:1,obStartTime:0,obTop:110,obBottom:105,
 ls:{dir:1,price:108,pivotTime:300,touchedTime:900}};
const familyKey=naturalSourceFamilyKey(source),key='XAUUSD:setup1:alias';
const range={setupKey:key,source,historyStart:2400,evaluatedThrough:iso(2400),suspendedAt:iso(2700)};
const windows={weekday:[[0,1440]],saturday:[],sunday:[]};
const fixture=()=>({enabled:true,instrument:'XAUUSD',state:{version:'test',configFingerprint:recoveryConfig([],windows,[]),
 suspendedRanges:[structuredClone(range)],activeRanges:[],evaluatedThrough:iso(3060),nativeHistoryRevision:0,
 sourceIdeaBindings:[['idea',{key:'idea',familyKey,knownAt:1800,selection:{selectedAt:1800},finalLifecycle:{main:{state:'ended',reason:'target1',recognizedAt:1860}}}],
 ['other',{key:'other',familyKey:'unrelated',knownAt:1000}]],
 entries:[{setupKey:'older-r2',entry:{id:'prior-entry',sourceFamilyKey:familyKey,ideaKey:'idea'}}]}});
const candles=async(_instrument,bar)=>bar==='1m'?Array.from({length:11},(_,i)=>({time:2400+i*60,high:105,low:95})):
 [{time:2400,high:105,low:95},{time:2700,high:105,low:95}];
it('feeds persistent first-selection/terminal bindings into recovery and preserves unrelated live updates',async()=>{
 const row=fixture(),saved=[];
 scan.mockImplementation(async input=>{
  expect(input.sourceIdeaBindings.get('idea').selection.selectedAt).toBe(1800);
  expect(input.sourceIdeaBindings.get('idea').finalLifecycle.main.recognizedAt).toBe(1860);
  expect(input.existingEntries.map(e=>e.entry.id)).toContain('prior-entry');
  input.onSnapshot({setupKey:key,direction:'short',dealingRange:{status:'validated'},rangeCourse:{lifecycle:{main:{state:'ended'}}}});return [];
 });
 await recoverSuspendedRange({row,range,sessions:[],schedules:[{instrument:'XAUUSD',trading_windows:windows}],news:[],
 cache:{anchors:[{knownAt:0,structureStartTime:0}],h1:[]},yieldControl:async()=>{},candles,acquire:async()=>true,release:async()=>{},
 readState:async()=>{const current=structuredClone(row);current.state.sourceIdeaBindings[1][1].knownAt=1500;return current;},
 checkpoint:async state=>saved.push(state)});
 expect(saved).toHaveLength(1);
 expect(new Map(saved[0].sourceIdeaBindings).get('idea').selection.selectedAt).toBe(1800);
 expect(new Map(saved[0].sourceIdeaBindings).get('other').knownAt).toBe(1500);
 const cache={historyRevision:0,scanMemo:{}};refreshRecoveredHistory(cache,saved[0]);
 expect(cache.ideaBindings.get('idea').finalLifecycle.main.reason).toBe('target1');
});
it('rejects a same-family binding race before checkpointing',async()=>{
 const row=fixture(),checkpoint=vi.fn(),release=vi.fn();
 scan.mockImplementation(async input=>{input.onSnapshot({setupKey:key,direction:'short',dealingRange:{status:'validated'},rangeCourse:{lifecycle:{main:{state:'ended'}}}});return [];});
 await recoverSuspendedRange({row,range,sessions:[],schedules:[{instrument:'XAUUSD',trading_windows:windows}],news:[],
 cache:{anchors:[{knownAt:0,structureStartTime:0}],h1:[]},yieldControl:async()=>{},candles,acquire:async()=>true,release,
 readState:async()=>{const current=structuredClone(row);current.state.sourceIdeaBindings[0][1].knownAt=1801;return current;},checkpoint});
 expect(checkpoint).not.toHaveBeenCalled();expect(release).toHaveBeenCalledOnce();
});
