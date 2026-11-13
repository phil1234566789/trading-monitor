import {describe,it,expect,vi} from 'vitest';
import {suspendChartScrolling} from '../src/chartScrollSuspension.js';

function fixture(){
 const original={mouseWheel:false,pressedMouseMove:true,horzTouchDrag:false,vertTouchDrag:true};
 const options={handleScroll:{...original}};
 const chart={options:()=>options,applyOptions:vi.fn(next=>Object.assign(options.handleScroll,next.handleScroll===false?Object.fromEntries(Object.keys(original).map(key=>[key,false])):next.handleScroll))};
 return {chart,original};
}

describe('temporary chart scrolling suspension',()=>{
 it('restores custom options after the chart mutates its own live options object',()=>{
  const {chart,original}=fixture(),restore=suspendChartScrolling(chart);
  expect(chart.options().handleScroll.pressedMouseMove).toBe(false);
  restore();expect(chart.options().handleScroll).toEqual(original);
  restore();expect(chart.applyOptions).toHaveBeenCalledTimes(2);
 });
 it.each([false,true])('keeps another active drawing suspended regardless of release order (%s)',reverse=>{
  const {chart,original}=fixture(),releases=[suspendChartScrolling(chart),suspendChartScrolling(chart)];
  if(reverse)releases.reverse();
  releases[0]();expect(chart.options().handleScroll.pressedMouseMove).toBe(false);
  releases[1]();expect(chart.options().handleScroll).toEqual(original);
 });
 it('does not enable scrolling which was already disabled before editing',()=>{
  const {chart}=fixture();Object.keys(chart.options().handleScroll).forEach(key=>chart.options().handleScroll[key]=false);
  suspendChartScrolling(chart)();expect(Object.values(chart.options().handleScroll)).toEqual([false,false,false,false]);
 });
});
