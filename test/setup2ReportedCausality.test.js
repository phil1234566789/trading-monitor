import {it,expect} from 'vitest';
import {orderBlockFollowsSweep,orderBlockRecognitionTimes} from '../src/orderBlockRecognitionTime.js';

it('separates September 30 first OB recognition from the 11:55 Berlin sweep',()=>{
  const at=clock=>Date.parse(`2026-09-30T${clock}:00+02:00`)/1000;
  const ob={startTime:at('11:05')};
  const candles=['11:00','11:05','11:10'].map(clock=>({time:at(clock)}));
  const recognized=orderBlockRecognitionTimes(candles,'5m').get(ob.startTime);
  expect(recognized).toBe(at('11:15'));
  for(const dir of [1,-1]) {
    expect(orderBlockFollowsSweep(ob,{dir,touchedTime:at('11:00'),fineTouchedTime:at('11:55')},recognized)).toBe(false);
    expect(orderBlockFollowsSweep(ob,{dir,touchedTime:at('11:00'),fineTouchedTime:at('11:10')},recognized)).toBe(false);
    expect(orderBlockFollowsSweep(ob,{dir,touchedTime:at('11:00'),fineTouchedTime:at('11:05')},recognized)).toBe(true);
  }
});
