import {berlinDateStrFor} from './berlinTime.js';

export function evaluateDoubleOrderBlockRetestDay(firstTouchTime,secondTouchTime) {
 if(![firstTouchTime,secondTouchTime].every(t=>Number.isSafeInteger(t)&&t>0))
  return {status:'unknown',reason:'retestDayUnknown'};
 // Gemeint sind die Retests am Berliner Kalendertag, nicht die Entstehung oder der FXCM-Handelstag.
 return berlinDateStrFor(firstTouchTime)===berlinDateStrFor(secondTouchTime)
  ?{status:'passed',reason:null}:{status:'rejected',reason:'differentRetestDays'};
}
