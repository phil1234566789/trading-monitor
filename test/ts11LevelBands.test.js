import {expect,it} from 'vitest';
import {ts11LevelBands} from '../src/ts11Chain.js';

const pt=(price,pivotTime)=>({price,pivotTime});
it('turns every chain level into a time band up to the start of the next level', () => {
 const chain={status:'ready',links:[
  {depth:0,trend:'uptrend',low:pt(90,1000),high:pt(120,2000)},
  {depth:1,trend:'downtrend',low:pt(95,3000),high:pt(120,2000)},
  {depth:2,trend:'uptrend',low:pt(95,3000),high:pt(110,3900)}],
  current:{depth:2,trend:'uptrend',low:pt(95,3000),high:pt(110,3900)}};
 expect(ts11LevelBands(chain,6000)).toEqual([
  {depth:0,trend:'uptrend',from:1000,to:2000,label:'WURZEL ↑'},
  {depth:1,trend:'downtrend',from:2000,to:3000,label:'T1 ↓'},
  {depth:2,trend:'uptrend',from:3000,to:6000,label:'T2 ↑ · aktuell'}]);
 expect(ts11LevelBands({status:'missing',links:[]},6000)).toEqual([]);
});
