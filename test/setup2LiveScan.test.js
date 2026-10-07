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
 const scanMemo={};
 const baseline=await scanTradeSetup2Window({...input,scanMemo}),seen=[],events=[],firstStructure=new Map();
 const live=await scanTradeSetup2Window({...input,scanMemo,onMinuteCheck:minute=>{seen.push(minute); const key=minute.context.setupKey; if(!firstStructure.has(key) && structureReady(minute.check.conditions,minute.context.direction,minute.knownAt))firstStructure.set(key,minute.knownAt); events.push(...minuteAlarmEvents({...minute,structureFirstKnownAt:firstStructure.get(key)},windows));}});
 const entrySummary=rows=>rows.filter(s=>s.entry).map(s=>({id:s.entry.id,at:s.entry.recognizedAt,stops:s.entry.stops,sizing:s.entry.sizing}));
 expect(entrySummary(live)).toEqual(entrySummary(baseline));
 expect(entrySummary(live)).toHaveLength(2);
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
