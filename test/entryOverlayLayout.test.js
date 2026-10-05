import {expect,it} from 'vitest';
import {entryOverlayLayout,entryOverlayViewport} from '../src/entryOverlayLayout.js';

it('keeps two entries and both risk variants beyond candle bodies at every pane width',()=>{
  for(const width of [600,1000,1500])for(const scales of [1,2]){
    const range={from:0,to:105},lastIndex=100,columns=2*scales;
    const next=entryOverlayViewport(range,lastIndex,width,columns);
    if(width<=20+columns*200+60){expect(next).toBe(range);continue;}
    const candleRight=(lastIndex-next.from)/(next.to-next.from)*width;
    const a=entryOverlayLayout(candleRight,0,scales);
    const b=entryOverlayLayout(candleRight,1,scales);
    expect(a.boxX).toBeGreaterThan(candleRight);expect(b.boxX).toBeGreaterThan(a.columns.at(-1));
    expect(b.columns.at(-1)+28).toBeLessThan(width);
  }
});
it('does not snap backward pan to the replay edge or clamp annotations onto candles',()=>{
  const past={from:0,to:50};expect(entryOverlayViewport(past,100,1000,2)).toBe(past);
  expect(entryOverlayLayout(999,0,1).boxX).toBe(1019);
  expect(entryOverlayLayout(null,0,1)).toBeNull();
  const roomy={from:0,to:200};expect(entryOverlayViewport(roomy,100,1000,2)).toBe(roomy);
});
