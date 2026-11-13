import {beforeEach,expect,it,vi} from 'vitest';
import {renderDoubleOrderBlocks,hitDoubleOrderBlock} from '../src/doubleOrderBlockRendering.js';
vi.mock('../src/chartColors.js',()=>({cssColor:key=>key,cssColorScaled:(key,alpha)=>`${key}:${alpha}`}));
vi.mock('../src/orderBlocks.js',()=>({OrderBlockPrimitive:class {constructor(zone,options){this.zone=zone;this.options=options;this.distance=Infinity;}distanceTo(){return this.distance;}}}));
const pair={id:'pair',recognizedAt:1000,firstOrderBlock:{startTime:100,top:12,bottom:10},secondOrderBlock:{startTime:400,top:14,bottom:12},
  entries:{a:{status:'ready',entryTime:1000,outcome:{status:'loss',recognizedAt:1500}},b:{status:'ready',entryTime:1100,outcome:{status:'success',recognizedAt:1600}}}};
let series;
beforeEach(()=>{series={attachPrimitive:vi.fn()};});
it('uses the detector display contract without leaking future loss or hiding separate a/b outcomes',()=>{
  expect(renderDoubleOrderBlocks(series,[pair],[],999)).toEqual([]);
  const atEntry=renderDoubleOrderBlocks(series,[pair],[],1000);
  expect(atEntry).toHaveLength(2);expect(atEntry[1].primitive.options.label).toContain('a: offen · b: wartet');
  const after=renderDoubleOrderBlocks(series,[pair],[],1700);
  expect(after[0].primitive.options.borderColor).toBe('tradeHover');
  expect(after[1].primitive.options.label).toContain('a: Loss · b: 2R');
});
it('renders red only according to the shared detector and hits either of the two actual boxes',()=>{
  const lost={...pair,entries:{a:pair.entries.a,b:{status:'pending'}}};
  const items=renderDoubleOrderBlocks(series,[lost],[],1500);
  expect(items[0].primitive.options.borderColor).toBe('tradeLoss');
  expect(hitDoubleOrderBlock(items,1,1)).toBe(null);
  items[0].primitive.distance=0;expect(hitDoubleOrderBlock(items,1,1)).toBe(lost);
  items[0].primitive.distance=Infinity;items[1].primitive.distance=0;expect(hitDoubleOrderBlock(items,1,1)).toBe(lost);
});
