import {instrumentConfig} from './instrumentConfig.js';
import {measureOrderBlockPriceGeometry} from './orderBlockPriceGeometry.js';

export function evaluateDoubleOrderBlockPriceGap(first,second,dir,instrument) {
 const maximum=instrumentConfig(instrument).dobMaxPositiveZoneGap;
 const measurement=measureOrderBlockPriceGeometry(first,second,dir);
 if(!measurement)return {status:'unknown',reason:'priceGapUnknown',maximum,positiveZoneGap:null};
 const {positiveZoneGap}=measurement;
 // Die 2 USD gelten ausschließlich für XAU; Forex bekommt keine implizite Gold-Preisschwelle.
 return maximum!==null&&positiveZoneGap>maximum
  ?{status:'rejected',reason:'priceGapTooWide',maximum,positiveZoneGap}
  :{status:'passed',reason:null,maximum,positiveZoneGap};
}
