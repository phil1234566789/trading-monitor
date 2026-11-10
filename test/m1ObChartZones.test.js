import {expect,it} from 'vitest';
import native from './fixtures/xau27OctM1FvgSelection.json';
import {collectObsZones} from '../src/priceChartObZones.js';
const at=clock=>Date.parse(`2026-10-27T${clock}:00+01:00`)/1000;
const zones=rows=>collectObsZones({showObsM1:true,m1Candles:rows,dbObZones:[],symbol:'XAUUSD'});
it('renders native M1 OB with the existing detector and does not bridge a missing formation candle',()=>{
 const formation=native.filter(c=>c.time>=at('08:23')&&c.time<=at('08:26'));
 expect(zones(formation)).toEqual([expect.objectContaining({timeframe:'1M',bottom:4006.18,top:4007.79,startTime:at('08:25')})]);
 const gap=formation.map((c,i)=>i===0?{...c,time:c.time-60}:c);
 expect(zones(gap)).toEqual([]);
 expect(zones(formation.slice(0,3))).toEqual([]);
});

it('does not claim a pre-gap OB stays active after later prices invalidate it',()=>{
 const formation=native.filter(c=>c.time>=at('08:23')&&c.time<=at('08:26'));
 const later={time:at('08:30'),open:4008,high:4010,low:4008,close:4009};
 expect(zones([...formation,later])).toEqual([]);
});
