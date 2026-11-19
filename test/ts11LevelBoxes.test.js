import {expect,it} from 'vitest';
import {ts11LevelBoxes} from '../src/tradeSetup11Debugger.js';

const pt=(price,pivotTime)=>({price,pivotTime});
it('draws every chain level from its oldest boundary pivot, skipping the current range', () => {
 const chain={status:'ready',links:[
  {depth:0,trend:'uptrend',low:pt(90,1000),high:pt(120,2000)},
  {depth:1,trend:'downtrend',low:pt(95,3000),high:pt(120,2000)},
  {depth:2,trend:'uptrend',low:pt(95,3000),high:pt(110,3900)}],
  current:{depth:2,trend:'uptrend',low:pt(95,3000),high:pt(110,3900)}};
 expect(ts11LevelBoxes(chain,6000,300)).toEqual([
  {depth:0,trend:'uptrend',top:120,bottom:90,startTime:900,endTime:6000,label:'T0 ↑ Wurzel'},
  {depth:1,trend:'downtrend',top:120,bottom:95,startTime:1800,endTime:6000,label:'T1 ↓'}]);
 expect(ts11LevelBoxes({status:'missing',links:[]},6000,300)).toEqual([]);
});
