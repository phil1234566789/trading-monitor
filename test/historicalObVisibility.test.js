import { describe, expect, it, vi } from 'vitest';
import { collectObsZones, filterHistorical } from '../src/priceChartObZones.js';
import { renderPersistedZones, orderBlockEndTime } from '../src/orderBlocks.js';
import { matchOBZone } from '../src/priceChartHitTest.js';
import { findNearestObTargets } from '../src/findTargets.js';
import { findAntiConfluenceObCandidates, findInvalidationObCandidates } from '../src/findAntiConfluences.js';
import { cssColor } from '../src/chartColors.js';

const at = Date.parse('2026-10-05T17:35:00+02:00') / 1000;
const m5 = [
  { time:0,open:1.2999,high:1.3,low:1.2998,close:1.29995 },
  { time:300,open:1.29995,high:1.3,low:1.2999,close:1.3 },
  { time:600,open:1.3,high:1.30005,low:1.29998,close:1.30002 },
  { time:900,open:1.30015,high:1.3003,low:1.3001,close:1.3002 },
  { time:1200,open:1.3,high:1.3001,low:1.2997,close:1.2998 },
];
describe.each(['5M','1H','4H'])('%s historical OB display is independent of validity', timeframe => {
  const ended = { instrument:'GBPUSD',timeframe,dir:-1,top:1.32368,bottom:1.32315,
    touched:true,invalidated:true,startTime:1791165600,endTime:1791187200 };
  function zones() {
    return collectObsZones({ showObsM5:timeframe==='5M',showObs1h:timeframe==='1H',showObs4h:timeframe==='4H',
      dbObZones:[ended],symbol:'GBPUSD',replayUntil:at,price:null,m5Candles:m5 });
  }
  it('retains an invalidated zone when historical OBs are enabled and hides it otherwise', () => {
    const all = zones();
    expect(all).toHaveLength(1);
    expect(all[0].invalidated).toBe(true);
    expect(filterHistorical(all,true)).toEqual(all);
    expect(filterHistorical(all,false)).toEqual([]);
  });
  it('draws it with existing inactive colors, a finished label and a finite endpoint', () => {
    const primitives = [], series = { attachPrimitive:vi.fn(),detachPrimitive:vi.fn() };
    renderPersistedZones(series,[ended],primitives,[{time:ended.startTime},{time:at}]);
    expect(series.attachPrimitive).toHaveBeenCalledTimes(1);
    expect(primitives[0].zone.invalidated).toBe(true);
    expect(orderBlockEndTime(primitives[0].zone)).toBe(ended.endTime);
    const key = timeframe==='5M'?'obInactiveM5':timeframe==='1H'?'obInactive1h':'obInactive4h';
    expect(primitives[0]._options.fillColor).toBe(cssColor(key));
    expect(primitives[0]._options.label).toContain('beendet');
  });
  it('never accepts a historical invalidated box as new evidence or target', () => {
    const zones = [{...ended,touched:false}];
    expect(filterHistorical(zones,false)).toEqual([]);
    expect(matchOBZone(zones,1.3233,ended.startTime+60,'GBPUSD')).toBeNull();
    expect(findNearestObTargets(zones,{direction:'long',currentPrice:1.32})).toEqual([]);
    expect(findAntiConfluenceObCandidates(zones,{direction:'long',zoneLow:1.32,zoneHigh:1.33,currentPrice:1.32,nowSec:at})).toEqual([]);
    expect(findInvalidationObCandidates(zones,{direction:'short',invalidation:1.3230})).toEqual([]);
    const valid = zones.map(z => ({...z,invalidated:false}));
    expect(matchOBZone(valid,1.3233,ended.startTime+60,'GBPUSD')).not.toBeNull();
    expect(findNearestObTargets(valid,{direction:'long',currentPrice:1.32})).toHaveLength(1);
    expect(findAntiConfluenceObCandidates(valid,{direction:'long',zoneLow:1.32,zoneHigh:1.33,currentPrice:1.32,nowSec:at})).toHaveLength(1);
    expect(findInvalidationObCandidates(valid,{direction:'short',invalidation:1.3230})).toHaveLength(1);
  });
});
