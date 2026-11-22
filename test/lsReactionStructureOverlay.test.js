import {describe,it,expect,vi} from 'vitest';
vi.mock('../src/m5CloseReaction.js',()=>({deriveM5CloseReaction:vi.fn(()=>({levels:['L']}))}));
import {deriveM5CloseReaction} from '../src/m5CloseReaction.js';
import {lsReactionStructureOverlay} from '../src/lsReactionStructureOverlay.js';

describe('lsReactionStructureOverlay',()=>{
 it('ohne fertigen LS-Reaktion-Kontext kein Overlay',()=>{
  expect(lsReactionStructureOverlay({status:'unknown',reason:'dailyAnchorUnknown'})).toBeNull();
  expect(lsReactionStructureOverlay(null)).toBeNull();
 });

 it('reicht Zustand, Pivots und D1-Anker des Kontexts unverändert durch',()=>{
  const ctx={status:'ready',state:{trend:'downtrend'},pivotsOuter:[1],pivotsInner:[2],periods:{outer:5,inner:2},
   candles:[{time:0}],anchor:{structureStartTime:1234}},cache=new Map();
  const o=lsReactionStructureOverlay(ctx,cache);
  expect(o.state).toBe(ctx.state);
  expect(o.pivotsOuter).toBe(ctx.pivotsOuter);
  expect(o.pivotsInner).toBe(ctx.pivotsInner);
  expect(o.anchorTime).toBe(1234);
  expect(o.closeReaction).toEqual({levels:['L']});
  // Dieselben Argumente wie currentM5StructureRange.
  expect(deriveM5CloseReaction).toHaveBeenCalledWith(ctx.state,ctx.pivotsOuter,ctx.pivotsInner,5,2,ctx.candles,300,cache);
 });
});
