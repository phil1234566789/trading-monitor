import { describe, expect, it } from 'vitest';
import { chartEventCoordinate, chartObjectCoordinate } from '../src/chartEventCoordinate.js';

describe('intrabar event coordinates', () => {
  const candles = [{ time:2700 }, { time:3000 }, { time:3900 }];
  const scale = { timeToCoordinate: time => ({ 2700:100,3000:120,3900:140 })[time], options: () => ({ barSpacing:20 }) };
  it('preserves the M1 minute inside M5, including the last known bar', () => {
    expect(chartEventCoordinate(scale,candles,2940,300)).toBe(116);
    expect(chartEventCoordinate(scale,candles,3000,300)).toBe(120);
    expect(chartEventCoordinate(scale,candles,4140,300)).toBe(156);
    expect(chartEventCoordinate({ ...scale, options: () => ({ barSpacing:40 }) },candles,2940,300)).toBe(132);
  });
  it.each([2640,3300,3600,4200])('does not clamp a missing event time %s', time => {
    expect(chartEventCoordinate(scale,candles,time,300)).toBeNull();
  });
});

it('projects only explicitly enabled idea geometry into the future',()=>{
 const candles=[{time:100},{time:160}],scale={timeToCoordinate:t=>t===160?20:0,options:()=>({barSpacing:10})};
 expect(chartObjectCoordinate(scale,candles,280)).toBe(20);
 expect(chartObjectCoordinate(scale,candles,280,undefined,60)).toBe(40);
});
