import { it, expect } from 'vitest';
import { entryModel1RetestFvg } from '../src/countertrendEntryModel1.js';

const candles = [[1.301,1.299],[1.311,1.309],[1.307,1.305],[1.301,1.299],
  [1.301,1.299],[1.321,1.316],[1.314,1.312],[1.311,1.309],
  [1.301,1.299],[1.321,1.316],[1.314,1.312],[1.311,1.309]]
  .map(([high,low],i)=>({time:i*60,open:low,close:high,high,low}));
const first = {dir:-1,startTime:-120,recognizedAt:0,top:1.302,bottom:1.299};
const older = {dir:-1,startTime:-180,recognizedAt:0,top:1.322,bottom:1.315};
function scenario(direction) {
  const mirror = c => ({...c,open:3-c.open,close:3-c.close,high:3-c.low,low:3-c.high});
  const zone = ob => ({...ob,dir:1,top:3-ob.bottom,bottom:3-ob.top});
  return direction==='short' ? {rows:candles,obs:[first,older]}
    : {rows:candles.map(mirror),obs:[first,older].map(zone)};
}

it.each(['short','long'])('selects an older OB only after its first later retest (%s)',direction=>{
  const {rows,obs}=scenario(direction),progress={};
  for (const at of [240,360,479]) {
    const result=entryModel1RetestFvg(rows,obs,0,direction,at,progress);
    expect(result.fvg.recognizedAt).toBe(240);
    expect(result.retest.orderBlock.startTime).toBe(first.startTime);
  }
  const result=entryModel1RetestFvg(rows,obs,0,direction,480,progress);
  expect(result).toMatchObject({retest:{candleTime:300,recognizedAt:360,
    orderBlock:{startTime:older.startTime,recognizedAt:0}},fvg:{recognizedAt:480}});
  // Weder weiterer Kontakt noch Neustart/Replay-Rücksprung erzeugt eine neue Mitigation.
  for (const at of [720,120,240,480,720]) {
    const cached=entryModel1RetestFvg(rows,obs,0,direction,at,progress);
    expect(cached).toEqual(entryModel1RetestFvg(rows,obs,0,direction,at));
    if(at>=480)expect(cached.fvg.recognizedAt).toBe(480);
  }
});

it.each(['short','long'])('never forgets an earlier retest just because that OB had no entry (%s)',direction=>{
  const {rows,obs}=scenario(direction);
  const early=direction==='short' ? {...rows[1],high:1.321,low:1.316}
    : {...rows[1],high:3-1.316,low:3-1.321};
  const history=rows.map((c,i)=>i===1?early:c);
  const progress={};
  const previous=entryModel1RetestFvg(history,obs.slice(0,1),0,direction,240,progress);
  expect(previous.fvg.recognizedAt).toBe(240);
  // Später nachgelieferter OB: sein erster Kontakt bleibt 60, nicht der erneute bei 300.
  for (const at of [480,720,120,720]) {
    const result=entryModel1RetestFvg(history,obs,0,direction,at,progress);
    expect(result).toEqual(entryModel1RetestFvg(history,obs,0,direction,at));
    if(at>=240)expect(result.fvg.recognizedAt).toBe(240);
  }
});

it.each(['short','long'])('does not treat a retest at the previous FVG time as later (%s)',direction=>{
  const {rows,obs}=scenario(direction);
  const touch=direction==='short' ? {...rows[4],high:1.321,low:1.316}
    : {...rows[4],high:3-1.316,low:3-1.321};
  const history=rows.map((c,i)=>i===4?touch:c);
  expect(entryModel1RetestFvg(history,obs,0,direction,720).fvg.recognizedAt).toBe(240);
});
