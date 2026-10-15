import {hydrateEvidence} from '../services/setup2/evidencePayload.js';
import {writeFileSync} from 'node:fs';
import {createLiveEvidence} from '../services/setup2/evidence.js';
import {it,expect} from 'vitest';
import {scanTradeSetup2Window} from '../src/tradeSetup2Scan.js';
import {buildHistoricalDailyAnchors} from '../src/tradeSetup2Anchors.js';
import {setup1RecognitionTime} from '../src/setup1RecognitionTime.js';
import {minuteAlarmEvents,structureReady} from '../services/setup2/events.js';
import fixture from './fixtures/gbpusd-m5-cd-97-105.json';
import continuation from './fixtures/gbpusd-m5-105-lifecycle.json';
import minutes from './fixtures/gbpusd-m1-entry-pattern1-97.json';
import sessions from './fixtures/gbpusd-m5-dr114-session-targets.json';
const windows={weekday:[[0,1440]],saturday:[],sunday:[]};
it('T68 minute hook observes closed pre-FVG minutes without changing batch entries',async()=>{
 const setup=fixture.setups[0],at=setup1RecognitionTime(setup);
 const input={instrument:'GBPUSD',tradeSetups:[setup],m5Candles:[...new Map([...fixture.m5Candles,...continuation].map(c=>[c.time,c])).values()],
  h1Candles:fixture.h1Candles,m1Candles:minutes,dailyAnchors:buildHistoricalDailyAnchors(fixture.dailyCandles,fixture.h1Candles),
  sessionConfigs:sessions.sessions,tradingWindows:windows,fromTime:at,toTime:Math.floor(at/86400)*86400+22*3600,yieldControl:()=>Promise.resolve()};
 const evidence=createLiveEvidence({instrument:input.instrument,sessions:input.sessionConfigs},{fromTime:input.fromTime,toTime:input.toTime,startedAt:input.fromTime});
 const scanMemo={};
 const baseline=await scanTradeSetup2Window({...input,scanMemo}),seen=[],events=[],firstStructure=new Map();
 let yieldCount=0,previousMinute=null,innerYield=false,captureMs=0,maxCaptureMs=0;
 const record=s=>{const before=performance.now();evidence.record(s);const cost=performance.now()-before;captureMs+=cost;maxCaptureMs=Math.max(maxCaptureMs,cost);};
 const live=await scanTradeSetup2Window({...input,scanMemo,onSnapshot:record,yieldEvery:1,yieldControl:async()=>{yieldCount++;await new Promise(resolve=>setTimeout(resolve,0));},onMinuteCheck:minute=>{const captureAt=performance.now();evidence.recordMinute(minute);const cost=performance.now()-captureAt;captureMs+=cost;maxCaptureMs=Math.max(maxCaptureMs,cost);
  const group=Math.floor((minute.knownAt-1)/300);if(previousMinute?.group===group && yieldCount>previousMinute.yields)innerYield=true;previousMinute={group,yields:yieldCount};seen.push(minute); const key=minute.context.setupKey; if(!firstStructure.has(key) && structureReady(minute.check.conditions,minute.context.direction,minute.knownAt))firstStructure.set(key,minute.knownAt); events.push(...minuteAlarmEvents({...minute,structureFirstKnownAt:firstStructure.get(key)},windows));}});
 const entrySummary=rows=>rows.filter(s=>s.entry).map(s=>({id:s.entry.id,at:s.entry.recognizedAt,stops:s.entry.stops,sizing:s.entry.sizing}));
 expect(innerYield).toBe(true);
 expect(entrySummary(live)).toEqual(entrySummary(baseline));
 expect(entrySummary(live)).toHaveLength(2);
 const completedAt=performance.now(),packed=evidence.complete(live),completeMs=performance.now()-completedAt,payloadMap=new Map(packed.payloads.map(p=>[p.id,p.payload]));
 const persisted={...packed,snapshots:packed.snapshots.map(s=>({...s,snapshot:hydrateEvidence(s.snapshot,payloadMap),observation:hydrateEvidence(s.observation,payloadMap)}))};
 expect(persisted.snapshots.filter(r=>r.snapshot.entry).map(r=>r.snapshot.entry.id)).toEqual(entrySummary(live).map(e=>e.id));
 expect(persisted.snapshots.some(r=>!r.snapshot.entry && r.snapshot.m1Check)).toBe(true);
 expect(persisted.snapshots.filter(r=>r.observation.checklistHistory?.entries.length>0 && r.observation.priceObservation)).toHaveLength(new Set(persisted.snapshots.map(r=>r.setup_key)).size);
 const serializedAt=performance.now(),serialized=JSON.stringify(packed);
 const metrics={snapshots:packed.snapshots.length,payloads:packed.payloads.length,captureMs,maxCaptureMs,completeMs,retainedBytes:Buffer.byteLength(JSON.stringify(packed.snapshots))+Buffer.byteLength(JSON.stringify(packed.payloads)),bytes:Buffer.byteLength(serialized),serializationMs:performance.now()-serializedAt};
 if(process.env.EVIDENCE_METRICS_FILE){writeFileSync(process.env.EVIDENCE_METRICS_FILE,JSON.stringify(metrics));
  writeFileSync(process.env.EVIDENCE_METRICS_FILE+'.packed.json',JSON.stringify(packed));
  writeFileSync(process.env.EVIDENCE_METRICS_FILE+'.largest.json',JSON.stringify(persisted.snapshots.reduce((a,b)=>JSON.stringify(a).length>JSON.stringify(b).length?a:b)));}
 expect(metrics.bytes).toBeLessThan(5_000_000);
 expect(persisted.snapshots.every(r=>r.snapshot.knownAt>=input.fromTime && !r.snapshot.checklistHistory)).toBe(true);
 expect(events.filter(e=>e.stage===1)).toHaveLength(1); const first=live.find(s=>s.entry).entry.recognizedAt;
 expect(seen.some(m=>m.knownAt<first && !m.check.conditions?.fvg)).toBe(true);
 expect(seen.every(m=>m.knownAt%60===0 && m.knownAt>=at && m.knownAt<=input.toTime)).toBe(true);
 expect(new Set(seen.map(m=>`${m.context.setupKey}:${m.knownAt}`)).size).toBe(seen.length);
 expect(events.filter(e=>e.stage===3).map(e=>Date.parse(e.signal_at)/1000)).toEqual(entrySummary(live).map(e=>e.at));
 // Start im bereits laufenden DR muss nicht das frühere FVG voraussetzen.
 const before=seen.find(m=>m.knownAt<first && !m.check.conditions?.fvg);
 const resumed=[];
 await scanTradeSetup2Window({...input,fromTime:before.knownAt,toTime:before.knownAt,onMinuteCheck:m=>resumed.push(m)});
 expect(resumed.map(m=>m.knownAt)).toEqual([before.knownAt]);
},30000);
