import {expect,it} from 'vitest';
import {evaluateDoubleOrderBlockPriceGap} from '../src/doubleOrderBlockPriceGap.js';
import {measureOrderBlockPriceGeometry} from '../src/orderBlockPriceGeometry.js';
import {instrumentConfig} from '../src/instrumentConfig.js';

it.each([1,-1])('allows exactly 2 USD and rejects a wider XAU gap in direction %s',dir=>{
 const first=dir===1?{bottom:100,top:104}:{bottom:106,top:110};
 const second=dir===1?{bottom:106,top:110}:{bottom:100,top:104};
 expect(evaluateDoubleOrderBlockPriceGap(first,second,dir,'XAUUSD')).toMatchObject({status:'passed',reason:null,positiveZoneGap:2,maximum:2});
 const wider=dir===1?{...second,bottom:106.01}:{...second,top:103.99};
 expect(evaluateDoubleOrderBlockPriceGap(first,wider,dir,'XAUUSD')).toMatchObject({status:'rejected',reason:'priceGapTooWide'});
});
it.each([1,-1])('permits touching and overlapping prices without demanding strict overlap for direction %s',dir=>{
 const first={bottom:100,top:104};
 for(const second of dir===1?[{bottom:104,top:108},{bottom:103,top:107}]:[{bottom:96,top:100},{bottom:97,top:101}])
  expect(evaluateDoubleOrderBlockPriceGap(first,second,dir,'XAUUSD')).toMatchObject({status:'passed',positiveZoneGap:0});
});
it.each(['GBPUSD','EURUSD'])('does not apply the XAU USD limit to %s',symbol=>{
 expect(instrumentConfig(symbol).pip).toBe(.0001);
 expect(instrumentConfig(symbol).dobMaxPositiveZoneGap).toBeNull();
 expect(evaluateDoubleOrderBlockPriceGap({bottom:100,top:104},{bottom:200,top:204},1,symbol))
  .toMatchObject({status:'passed',maximum:null,positiveZoneGap:96});
});
it('does not manufacture geometry or confirmation from invalid zones',()=>{
 expect(measureOrderBlockPriceGeometry({bottom:100,top:100},{bottom:101,top:104},1)).toBeNull();
 expect(evaluateDoubleOrderBlockPriceGap({bottom:100,top:NaN},{bottom:101,top:104},1,'XAUUSD').status).toBe('unknown');
});
