import {describe,it,expect,vi} from 'vitest';
vi.mock('../src/m5CloseReaction.js',()=>({deriveM5CloseReaction:vi.fn(()=>({levels:['L']}))}));
import {deriveM5CloseReaction} from '../src/m5CloseReaction.js';
import {ts11StructureOverlay} from '../src/ts11StructureOverlay.js';

describe('ts11StructureOverlay',()=>{
 it('ohne fertigen TS1.1-Kontext kein Overlay',()=>{
  expect(ts11StructureOverlay({status:'unknown',reason:'dailyAnchorUnknown'})).toBeNull();
  expect(ts11StructureOverlay(null)).toBeNull();
 });

 it('reicht Zustand, Pivots und D1-Anker des Kontexts unverändert durch',()=>{
  const ctx={status:'ready',state:{trend:'downtrend'},pivotsOuter:[1],pivotsInner:[2],periods:{outer:5,inner:2},
   candles:[{time:0}],anchor:{structureStartTime:1234}},cache=new Map();
  const o=ts11StructureOverlay(ctx,cache);
  expect(o.state).toBe(ctx.state);
  expect(o.pivotsOuter).toBe(ctx.pivotsOuter);
  expect(o.pivotsInner).toBe(ctx.pivotsInner);
  expect(o.anchorTime).toBe(1234);
  expect(o.closeReaction).toEqual({levels:['L']});
  // Dieselben Argumente wie currentTradeSetup11Range.
  expect(deriveM5CloseReaction).toHaveBeenCalledWith(ctx.state,ctx.pivotsOuter,ctx.pivotsInner,5,2,ctx.candles,300,cache);
 });
});
