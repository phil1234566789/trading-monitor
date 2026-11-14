export const DEFAULT_MAX_RETEST_DEPTH_FRACTION=.5;

export function validateDoubleOrderBlockDepthLimit(maximum) {
 if(!Number.isFinite(maximum)||maximum<0||maximum>1)
  throw new RangeError('Die maximale DOB-Retesttiefe muss zwischen 0 und 1 liegen.');
 return maximum;
}

export function evaluateDoubleOrderBlockDepth(firstPenetration,secondPenetration,maximum=DEFAULT_MAX_RETEST_DEPTH_FRACTION) {
 validateDoubleOrderBlockDepthLimit(maximum);
 for(const [role,measurement] of [['first',firstPenetration],['second',secondPenetration]]) {
  if(measurement?.status!=='ready'||!Number.isFinite(measurement.maxPenetrationFraction))
   return {status:'unknown',reason:`${role}RetestDepthUnknown`};
  if(measurement.maxPenetrationFraction>maximum)return {status:'rejected',reason:`${role}RetestTooDeep`};
 }
 return {status:'passed',reason:null};
}
