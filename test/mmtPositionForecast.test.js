import {describe,it,expect} from 'vitest';
import {calcPositionLineForecast} from '../src/mmtPositionForecast.js';

const forecast=extra=>calcPositionLineForecast({direction:'long',entryPrice:100,price:102,volume:.5,positionVolume:1,basisSl:99,
 minimumVolume:.01,lossPerUnit:1,profitPerUnit:1.2,entryCosts:-10,entryVolume:2,swap:-4,estimatedExitCostsPerLot:-5,currency:'USD',...extra});

describe('native position line forecast',()=>{
 it('uses the native favorable coefficient and allocates only this line’s costs',()=>{
  expect(forecast()).toEqual({gross:120,estimatedNet:113,rr:2,entryCosts:-2.5,swap:-2,estimatedExitCosts:-2.5,currency:'USD',costsKnown:true});
 });
 it('uses the adverse coefficient for a long stop and preserves unweighted price R',()=>{
  expect(forecast({price:99})).toMatchObject({gross:-50,estimatedNet:-57,rr:-1});
  expect(forecast({price:99,volume:.25})).toMatchObject({gross:-25,estimatedNet:-28.5,rr:-1});
 });
 it('mirrors native short profit and loss without swapping their coefficients',()=>{
  expect(forecast({direction:'short',price:98,basisSl:101})).toMatchObject({gross:120,estimatedNet:113,rr:2});
  expect(forecast({direction:'short',price:101,basisSl:101})).toMatchObject({gross:-50,estimatedNet:-57,rr:-1});
 });
 it('allocates original entry costs against original fills after partial closes',()=>{
  const first=forecast({volume:.25,positionVolume:.5,entryVolume:2});
  expect(first.entryCosts).toBe(-1.25);
  expect(first.swap).toBe(-2);
  expect(first.estimatedNet).toBe(55.5);
 });
 it('treats documented zero exit fees and zero swap as known, without mirroring entry fees',()=>{
  expect(forecast({swap:0,estimatedExitCostsPerLot:0})).toMatchObject({entryCosts:-2.5,estimatedExitCosts:0,estimatedNet:117.5,costsKnown:true});
 });
 it('keeps positive posted swap credits instead of turning them into costs',()=>{
  expect(forecast({swap:4})).toMatchObject({swap:2,estimatedNet:117});
 });
 it.each(['entryCosts','entryVolume','swap','estimatedExitCostsPerLot'])('does not invent missing %s',key=>{
  expect(forecast({[key]:null})).toMatchObject({gross:120,rr:2,estimatedNet:null,costsKnown:false});
 });
 it('keeps unknown R separate from a known net estimate',()=>{
  expect(forecast({basisSl:null})).toMatchObject({gross:120,estimatedNet:113,rr:null,costsKnown:true});
  expect(forecast({basisSl:100}).rr).toBeNull();
 });
 it('does not substitute the loss coefficient when a profit coefficient is missing',()=>{
  expect(forecast({profitPerUnit:null})).toMatchObject({gross:null,estimatedNet:null});
  expect(forecast({price:99,lossPerUnit:null})).toMatchObject({gross:null,estimatedNet:null});
 });
 it('only requires the coefficient needed for this side of the entry',()=>{
  expect(forecast({lossPerUnit:null}).gross).toBe(120);
  expect(forecast({price:99,profitPerUnit:null}).gross).toBe(-50);
 });
 it('shows the known costs at the entry even without a price conversion coefficient',()=>{
  expect(forecast({price:100,profitPerUnit:null,lossPerUnit:null})).toMatchObject({gross:0,estimatedNet:-7,rr:0});
 });
 it.each([0,-.5,NaN,Infinity])('does not produce amounts for invalid line volume %s',volume=>{
  expect(forecast({volume})).toMatchObject({gross:null,estimatedNet:null,costsKnown:false});
 });
 it('does not allocate more than the open position or known original fills',()=>{
  expect(forecast({volume:1.1})).toMatchObject({gross:null,estimatedNet:null,costsKnown:false});
  expect(forecast({entryVolume:.25})).toMatchObject({entryCosts:null,estimatedNet:null,costsKnown:false});
 });
 it('does not assume an account currency or use a zero native minimum volume',()=>{
  expect(forecast({currency:undefined})).toMatchObject({estimatedNet:null,currency:null});
  expect(forecast({minimumVolume:0})).toMatchObject({gross:null,estimatedNet:null});
 });
 it('does not apply a risk reserve as a fee or double-count posted costs',()=>{
  expect(forecast({costBuffer:25})).toEqual(forecast());
 });
});
