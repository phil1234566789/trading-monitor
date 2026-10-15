import {observeDealingRangePrice,dealingRangeValidationPrice} from '../../src/dealingRangePriceObservation.js';

import {markIgnoredCandles} from '../../src/sessionOccurrences.js';

import {berlinOffsetMinutes} from '../../src/berlinTime.js';

import {candleTimeIndex} from '../../src/candleTimeIndex.js';



// Der erste archivierte Stand ist der Anker; fehlende Vorgeschichte bleibt ausdrücklich unbekannt.

export function observeCapturedRanges({origins,previous={},m5Candles,sessionConfigs,instrument,toTime,configurationId}) {

 const state=structuredClone(previous),rows=m5Candles,sessions=sessionConfigs.filter(s=>s.instrument===instrument);

 for(const origin of origins) {

  const saved=state[origin.setupKey],sourceValidatedAt=origin.sourceValidatedAt ?? origin.validatedAt;

  const coverage=saved?.coverage ?? {originSnapshotId:origin.originSnapshotId,validatedAt:origin.validatedAt,sourceValidatedAt,

   configurationId,missingBeforeCapture:Math.floor(origin.validatedAt/60)*60>Math.ceil(sourceValidatedAt/60)*60};

  const parameters=saved?.parameters ?? {...origin,validatedAt:coverage.validatedAt,

   validationPrice:dealingRangeValidationPrice(rows,coverage.validatedAt)};

  const from=saved?.observation?.rawEndReason!=='missingHistory' && Number.isFinite(saved?.observation?.rawThrough)

   ? saved.observation.rawThrough : Math.ceil(parameters.validatedAt/300)*300;

  const tail=markIgnoredCandles(rows.slice(candleTimeIndex(rows,from)),sessions,t=>berlinOffsetMinutes(t*1000));

  const observation=observeDealingRangePrice({...parameters,candles:tail,windowEnd:toTime,previous:saved?.observation});

  state[origin.setupKey]={coverage:{...coverage,evaluatedThrough:toTime},parameters,observation};

 }

 return state;

}


export function mergeCapturedRangeState(fresh={},local={},pendingKeys=[]) {
 const merged={...fresh};
 for(const key of pendingKeys){
  const pending=local[key],saved=fresh[key];if(!pending)continue;
  if(saved && (saved.coverage.originSnapshotId!==pending.coverage.originSnapshotId
   || saved.coverage.validatedAt!==pending.coverage.validatedAt
   || saved.coverage.evaluatedThrough>=pending.coverage.evaluatedThrough))continue;
  merged[key]=pending;
 }
 return merged;
}
