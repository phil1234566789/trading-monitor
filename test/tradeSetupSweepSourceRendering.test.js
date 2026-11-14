import {expect,it,vi} from 'vitest';
const calls=vi.hoisted(()=>[]);
vi.mock('../src/liquidity.js',async original=>({...await original(),LiquidityLinePrimitive:class{
  constructor(level,options){calls.push({level,options});}
}}));
import {usePriceChartTradeSetupDrawing} from '../src/composables/usePriceChartTradeSetupDrawing.js';

it('labels an OB-edge sweep without inventing a protected pivot or changing its source',()=>{
  const level={sourceKind:'orderBlock',sourceStartTime:100,sourceKnownAt:700,
    sourceTop:15,sourceBottom:12,sourceDirection:-1,price:15,pivotTime:100,touchedTime:800,dir:1};
  const before=structuredClone(level),drawing=usePriceChartTradeSetupDrawing();
  drawing.create({attachPrimitive:vi.fn(),detachPrimitive:vi.fn()});
  drawing.refresh([{dir:1,ls:level,fractal:level,obStartTime:900,obTop:20,obBottom:18}],{
    candles:[],symbol:'XAUUSD',replayUntil:1200,showTradeSetups:true,showTradeSetupsShort:true,
    showTradeSetupsLong:true,showLiquidityDebug:true});
  expect(calls).toHaveLength(1);
  expect(calls[0].options.label).toMatch(/^OB-Kante · .*LS 15/);
  expect(calls[0].level).toBe(level);
  expect(level).toEqual(before);
});
