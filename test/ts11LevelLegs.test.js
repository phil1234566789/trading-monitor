import {expect,it} from 'vitest';
import {ts11LevelLegs} from '../src/tradeSetup11Debugger.js';

const pt=(price,pivotTime)=>({price,pivotTime});
it('draws every chain level as one leg from its older to its newer boundary pivot', () => {
 const chain={status:'ready',links:[
  {depth:0,trend:'uptrend',low:pt(90,1000),high:pt(120,2000)},
  {depth:1,trend:'downtrend',low:pt(95,3000),high:pt(120,2000)},
  {depth:2,trend:'uptrend',low:pt(95,3000),high:pt(110,3900)}],
  current:{depth:2,trend:'uptrend',low:pt(95,3000),high:pt(110,3900)}};
 expect(ts11LevelLegs(chain)).toEqual([
  {depth:0,trend:'uptrend',points:[pt(90,1000),pt(120,2000)],label:'T0 ↑ Wurzel'},
  {depth:1,trend:'downtrend',points:[pt(120,2000),pt(95,3000)],label:'T1 ↓'},
  {depth:2,trend:'uptrend',points:[pt(95,3000),pt(110,3900)],label:'T2 ↑ aktuell'}]);
 expect(ts11LevelLegs({status:'missing',links:[]})).toEqual([]);
});
